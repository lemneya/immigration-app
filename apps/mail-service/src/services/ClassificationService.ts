/**
 * Document Classification Service
 * Uses Gemma embeddings + keyword matching to classify document types
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { DatabaseService } from './DatabaseService';

import type { DocumentClassificationResult, DocumentType } from '../models/types';

export class ClassificationService {
  private embedServiceUrl: string;
  private dbService: DatabaseService;
  private labelEmbeddings: Map<DocumentType, number[]> = new Map();
  private keywordPatterns: Map<DocumentType, string[]> = new Map();
  private initialized = false;

  constructor(embedServiceUrl: string, dbService: DatabaseService) {
    this.embedServiceUrl = embedServiceUrl;
    this.dbService = dbService;
  }

  async initialize(): Promise<void> {
    try {
      await this.loadDocumentLabels();
      await this.generateLabelEmbeddings();
      this.initialized = true;
      logger.info('Classification service initialized with embeddings');
    } catch (error) {
      logger.error('Failed to initialize classification service:', error);
      throw error;
    }
  }

  /**
   * Classify document using hybrid approach: embeddings + keywords
   */
  async classifyDocument(text: string): Promise<DocumentClassificationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Approach 1: Keyword-based classification (fast, reliable for obvious cases)
      const keywordResult = this.classifyByKeywords(text);
      
      if (keywordResult.confidence >= 0.8) {
        logger.debug('High-confidence keyword classification:', keywordResult);
        return keywordResult;
      }

      // Approach 2: Embedding-based classification (semantic understanding)
      const embeddingResult = await this.classifyByEmbeddings(text);
      
      // Combine results - prefer embedding result but boost if keywords agree
      let finalResult = embeddingResult;
      
      if (keywordResult.doc_type === embeddingResult.doc_type) {
        // Both methods agree - boost confidence
        finalResult.confidence = Math.min(
          (keywordResult.confidence + embeddingResult.confidence) / 1.5, 
          1.0
        );
        finalResult.matched_keywords = keywordResult.matched_keywords;
      } else if (keywordResult.confidence > 0.5 && embeddingResult.confidence < 0.7) {
        // Keywords are more confident - use keyword result
        finalResult = keywordResult;
        finalResult.embedding_similarity = embeddingResult.confidence;
      }

      logger.debug('Document classification result:', {
        docType: finalResult.doc_type,
        confidence: finalResult.confidence,
        keywordMatches: finalResult.matched_keywords?.length || 0,
        embeddingSimilarity: finalResult.embedding_similarity
      });

      return finalResult;

    } catch (error) {
      logger.error('Document classification failed:', error);
      
      // Fallback to basic keyword classification
      const fallbackResult = this.classifyByKeywords(text);
      fallbackResult.fallback_used = true;
      return fallbackResult;
    }
  }

  /**
   * Classify document based on keyword patterns
   */
  private classifyByKeywords(text: string): DocumentClassificationResult {
    const textLower = text.toLowerCase();
    let bestMatch: DocumentType = 'other';
    let maxMatches = 0;
    let matchedKeywords: string[] = [];

    for (const [docType, keywords] of this.keywordPatterns.entries()) {
      const matches = keywords.filter(keyword => 
        textLower.includes(keyword.toLowerCase())
      );
      
      if (matches.length > maxMatches) {
        maxMatches = matches.length;
        bestMatch = docType;
        matchedKeywords = matches;
      }
    }

    // Calculate confidence based on keyword density and specificity
    const confidence = maxMatches > 0 
      ? Math.min((maxMatches * 0.2) + 0.3, 1.0)
      : 0.1;

    return {
      doc_type: bestMatch,
      confidence,
      matched_keywords: matchedKeywords
    };
  }

  /**
   * Classify document using semantic embeddings
   */
  private async classifyByEmbeddings(text: string): Promise<DocumentClassificationResult> {
    try {
      // Get embedding for the document text
      const textEmbedding = await this.getTextEmbedding(text);
      
      if (!textEmbedding || textEmbedding.length === 0) {
        throw new Error('Failed to generate text embedding');
      }

      // Compare with label embeddings
      let bestMatch: DocumentType = 'other';
      let maxSimilarity = 0;

      for (const [docType, labelEmbedding] of this.labelEmbeddings.entries()) {
        const similarity = this.cosineSimilarity(textEmbedding, labelEmbedding);
        
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestMatch = docType;
        }
      }

      return {
        doc_type: bestMatch,
        confidence: maxSimilarity,
        matched_keywords: [],
        embedding_similarity: maxSimilarity
      };

    } catch (error) {
      logger.error('Embedding-based classification failed:', error);
      throw error;
    }
  }

  /**
   * Get text embedding from embedding service
   */
  private async getTextEmbedding(text: string): Promise<number[]> {
    try {
      // Truncate text if too long
      const truncatedText = text.length > 2000 ? text.substring(0, 2000) : text;
      
      const response = await axios.post(`${this.embedServiceUrl}/embed`, {
        texts: [truncatedText]
      }, {
        timeout: 30000
      });

      if (response.data.embeddings && response.data.embeddings.length > 0) {
        return response.data.embeddings[0];
      } else {
        throw new Error('No embeddings returned from service');
      }

    } catch (error) {
      logger.error('Failed to get text embedding:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length for cosine similarity');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Load document labels from database
   */
  private async loadDocumentLabels(): Promise<void> {
    const client = await this.dbService.getClient();
    
    try {
      const result = await client.query(`
        SELECT doc_type, keywords, embedding, confidence_threshold
        FROM mail_doc_labels 
        WHERE active = true
        ORDER BY doc_type
      `);

      for (const row of result.rows) {
        const docType = row.doc_type as DocumentType;
        this.keywordPatterns.set(docType, row.keywords);
        
        // If embedding exists in DB, use it
        if (row.embedding) {
          this.labelEmbeddings.set(docType, Array.from(row.embedding));
        }
      }

      logger.info(`Loaded ${result.rows.length} document type labels`);

    } catch (error) {
      logger.error('Failed to load document labels:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Generate embeddings for document type labels
   */
  private async generateLabelEmbeddings(): Promise<void> {
    const client = await this.dbService.getClient();
    
    try {
      // Generate embeddings for labels that don't have them
      for (const [docType, keywords] of this.keywordPatterns.entries()) {
        if (!this.labelEmbeddings.has(docType)) {
          try {
            // Create representative text from keywords for embedding
            const labelText = this.createLabelText(docType, keywords);
            const embedding = await this.getTextEmbedding(labelText);
            
            this.labelEmbeddings.set(docType, embedding);
            
            // Save embedding to database
            await client.query(`
              UPDATE mail_doc_labels 
              SET embedding = $1 
              WHERE doc_type = $2
            `, [JSON.stringify(embedding), docType]);
            
            logger.debug(`Generated embedding for document type: ${docType}`);
            
          } catch (error) {
            logger.warn(`Failed to generate embedding for ${docType}:`, error);
          }
        }
      }

    } catch (error) {
      logger.error('Failed to generate label embeddings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create representative text for document type from keywords
   */
  private createLabelText(docType: DocumentType, keywords: string[]): string {
    // Create contextual sentences using keywords to improve embedding quality
    const sentences = [];
    
    switch (docType) {
      case 'uscis_notice':
        sentences.push('This is a USCIS immigration notice document.');
        sentences.push(`It contains information about ${keywords.slice(0, 3).join(', ')}.`);
        break;
      
      case 'insurance_notice':
        sentences.push('This is an insurance document or notice.');
        sentences.push(`It includes details about ${keywords.slice(0, 3).join(', ')}.`);
        break;
      
      case 'bank_statement':
        sentences.push('This is a bank statement or financial document.');
        sentences.push(`It shows ${keywords.slice(0, 3).join(', ')}.`);
        break;
      
      case 'credit_card_notice':
        sentences.push('This is a credit card statement or notice.');
        sentences.push(`It contains ${keywords.slice(0, 3).join(', ')}.`);
        break;
      
      case 'utility_bill':
        sentences.push('This is a utility bill or service statement.');
        sentences.push(`It includes ${keywords.slice(0, 3).join(', ')}.`);
        break;
      
      case 'tax_document':
        sentences.push('This is a tax document or IRS notice.');
        sentences.push(`It contains ${keywords.slice(0, 3).join(', ')}.`);
        break;
      
      case 'legal_notice':
        sentences.push('This is a legal notice or court document.');
        sentences.push(`It includes ${keywords.slice(0, 3).join(', ')}.`);
        break;
      
      default:
        sentences.push('This is a general document.');
        sentences.push(`Keywords: ${keywords.slice(0, 5).join(', ')}.`);
    }
    
    return sentences.join(' ');
  }

  /**
   * Add new document type label
   */
  async addDocumentLabel(
    docType: DocumentType,
    keywords: string[],
    confidenceThreshold: number = 0.75
  ): Promise<void> {
    const client = await this.dbService.getClient();
    
    try {
      // Generate embedding for the label
      const labelText = this.createLabelText(docType, keywords);
      const embedding = await this.getTextEmbedding(labelText);
      
      // Insert into database
      await client.query(`
        INSERT INTO mail_doc_labels (doc_type, keywords, embedding, confidence_threshold)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (doc_type) DO UPDATE SET
          keywords = $2,
          embedding = $3,
          confidence_threshold = $4,
          active = true
      `, [docType, keywords, JSON.stringify(embedding), confidenceThreshold]);
      
      // Update local cache
      this.keywordPatterns.set(docType, keywords);
      this.labelEmbeddings.set(docType, embedding);
      
      logger.info(`Added/updated document label for type: ${docType}`);
      
    } catch (error) {
      logger.error(`Failed to add document label for ${docType}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get classification statistics
   */
  async getClassificationStats(): Promise<Record<string, any>> {
    const client = await this.dbService.getClient();
    
    try {
      const result = await client.query(`
        SELECT 
          doc_type,
          COUNT(*) as count,
          AVG((confidence_scores->>'document_classification')::float) as avg_confidence
        FROM mail_jobs 
        WHERE doc_type IS NOT NULL 
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY doc_type
        ORDER BY count DESC
      `);

      const stats = {
        total_classifications: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
        by_type: {},
        available_types: Array.from(this.keywordPatterns.keys()),
        embedding_service_available: this.labelEmbeddings.size > 0
      };

      for (const row of result.rows) {
        stats.by_type[row.doc_type] = {
          count: parseInt(row.count),
          avg_confidence: parseFloat(row.avg_confidence) || 0
        };
      }

      return stats;

    } catch (error) {
      logger.error('Failed to get classification stats:', error);
      return { error: 'Failed to retrieve stats' };
    } finally {
      client.release();
    }
  }
}