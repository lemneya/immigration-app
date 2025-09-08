import { GoogleAIEmbeddings } from '@google-ai/generativelanguage';
import * as tf from '@tensorflow/tfjs';

export interface EmbeddingVector {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface SimilarityResult {
  id: string;
  similarity: number;
  metadata: Record<string, any>;
}

export interface FraudDetectionResult {
  isFraudulent: boolean;
  confidence: number;
  reasons: string[];
  riskScore: number;
}

export class EmbeddingsService {
  private googleAI: GoogleAIEmbeddings;
  private documentEmbeddings: Map<string, EmbeddingVector> = new Map();
  private fraudPatterns: EmbeddingVector[] = [];

  constructor() {
    this.initializeGoogleAI();
    this.loadFraudPatterns();
  }

  private async initializeGoogleAI(): Promise<void> {
    try {
      const apiKey = process.env.GOOGLE_AI_API_KEY;
      if (!apiKey) {
        console.warn('Google AI API key not found, using fallback embeddings');
        return;
      }
      
      this.googleAI = new GoogleAIEmbeddings({
        apiKey,
        model: 'models/embedding-001'
      });
    } catch (error) {
      console.error('Failed to initialize Google AI embeddings:', error);
    }
  }

  /**
   * Generate embeddings for text using Gemma
   */
  async generateEmbedding(text: string, id?: string): Promise<EmbeddingVector> {
    try {
      let vector: number[];
      
      if (this.googleAI) {
        const response = await this.googleAI.embedDocuments([text]);
        vector = response[0];
      } else {
        // Fallback to simple TensorFlow.js embeddings
        vector = await this.generateFallbackEmbedding(text);
      }

      const embedding: EmbeddingVector = {
        id: id || `embed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        vector,
        metadata: { text, length: text.length },
        timestamp: new Date()
      };

      // Store embedding for future similarity searches
      if (id) {
        this.documentEmbeddings.set(id, embedding);
      }

      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Fallback embedding generation using simple text features
   */
  private async generateFallbackEmbedding(text: string): Promise<number[]> {
    try {
      // Simple feature extraction
      const features = this.extractTextFeatures(text);
      
      // Convert to tensor and normalize
      const tensor = tf.tensor1d(features);
      const normalized = tf.div(tensor, tf.norm(tensor));
      const embedding = await normalized.data();
      
      tensor.dispose();
      normalized.dispose();
      
      return Array.from(embedding);
    } catch (error) {
      console.error('Fallback embedding generation failed:', error);
      // Ultimate fallback - random vector
      return Array.from({ length: 128 }, () => Math.random() - 0.5);
    }
  }

  /**
   * Extract simple text features for embedding
   */
  private extractTextFeatures(text: string): number[] {
    const features: number[] = [];
    
    // Basic text statistics
    features.push(text.length);
    features.push(text.split(' ').length);
    features.push(text.split('\n').length);
    features.push(text.split(/[.!?]/).length);
    
    // Character frequency features
    const charFreq = this.getCharacterFrequencies(text.toLowerCase());
    const commonChars = 'abcdefghijklmnopqrstuvwxyz0123456789 ';
    
    for (const char of commonChars) {
      features.push(charFreq[char] || 0);
    }
    
    // Word-based features
    const words = text.toLowerCase().split(/\s+/);
    const wordFeatures = this.extractWordFeatures(words);
    features.push(...wordFeatures);
    
    // Pad or truncate to fixed size (128 dimensions)
    while (features.length < 128) {
      features.push(0);
    }
    
    return features.slice(0, 128);
  }

  /**
   * Get character frequencies
   */
  private getCharacterFrequencies(text: string): Record<string, number> {
    const freq: Record<string, number> = {};
    const totalChars = text.length;
    
    for (const char of text) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    // Normalize frequencies
    for (const char in freq) {
      freq[char] = freq[char] / totalChars;
    }
    
    return freq;
  }

  /**
   * Extract word-based features
   */
  private extractWordFeatures(words: string[]): number[] {
    const features: number[] = [];
    
    // Average word length
    const avgWordLength = words.length > 0 ? 
      words.reduce((sum, word) => sum + word.length, 0) / words.length : 0;
    features.push(avgWordLength);
    
    // Common immigration-related keywords
    const immigrationKeywords = [
      'uscis', 'visa', 'green', 'card', 'immigration', 'naturalization',
      'citizenship', 'form', 'application', 'petition', 'status'
    ];
    
    const keywordCount = words.filter(word => 
      immigrationKeywords.some(keyword => word.includes(keyword))
    ).length;
    
    features.push(keywordCount / words.length);
    
    // Financial keywords (for fraud detection)
    const financialKeywords = [
      'bank', 'account', 'payment', 'money', 'transfer', 'fee',
      'deposit', 'withdraw', 'credit', 'debit'
    ];
    
    const financialCount = words.filter(word =>
      financialKeywords.some(keyword => word.includes(keyword))
    ).length;
    
    features.push(financialCount / words.length);
    
    // Urgency keywords (for fraud detection)
    const urgencyKeywords = [
      'urgent', 'immediate', 'asap', 'quickly', 'now', 'today',
      'deadline', 'expires', 'limited'
    ];
    
    const urgencyCount = words.filter(word =>
      urgencyKeywords.some(keyword => word.includes(keyword))
    ).length;
    
    features.push(urgencyCount / words.length);
    
    return features;
  }

  /**
   * Find similar documents using vector similarity
   */
  async findSimilarDocuments(
    queryText: string, 
    topK: number = 5,
    threshold: number = 0.7
  ): Promise<SimilarityResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(queryText);
      const results: SimilarityResult[] = [];
      
      for (const [id, docEmbedding] of this.documentEmbeddings) {
        const similarity = this.calculateCosineSimilarity(
          queryEmbedding.vector,
          docEmbedding.vector
        );
        
        if (similarity >= threshold) {
          results.push({
            id,
            similarity,
            metadata: docEmbedding.metadata
          });
        }
      }
      
      // Sort by similarity and return top K
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      console.error('Error finding similar documents:', error);
      return [];
    }
  }

  /**
   * Detect fraud/scam documents using embeddings
   */
  async detectFraud(documentText: string): Promise<FraudDetectionResult> {
    try {
      const docEmbedding = await this.generateEmbedding(documentText);
      let maxSimilarity = 0;
      const reasons: string[] = [];
      
      // Check similarity to known fraud patterns
      for (const fraudPattern of this.fraudPatterns) {
        const similarity = this.calculateCosineSimilarity(
          docEmbedding.vector,
          fraudPattern.vector
        );
        
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
        }
        
        if (similarity > 0.8) {
          reasons.push(fraudPattern.metadata.reason || 'Similar to known fraud pattern');
        }
      }
      
      // Additional heuristic checks
      const heuristicScore = this.performHeuristicFraudCheck(documentText);
      const combinedScore = Math.max(maxSimilarity, heuristicScore);
      
      return {
        isFraudulent: combinedScore > 0.6,
        confidence: combinedScore,
        reasons: reasons.length > 0 ? reasons : this.getHeuristicReasons(documentText),
        riskScore: combinedScore
      };
    } catch (error) {
      console.error('Error detecting fraud:', error);
      return {
        isFraudulent: false,
        confidence: 0,
        reasons: [],
        riskScore: 0
      };
    }
  }

  /**
   * Provide contextual help for form fields using embeddings
   */
  async getContextualHelp(fieldName: string, context: string): Promise<string> {
    try {
      // Create embedding for the field context
      const contextEmbedding = await this.generateEmbedding(`${fieldName} ${context}`);
      
      // Find similar help content
      const helpDatabase = this.getHelpDatabase();
      let bestMatch = '';
      let bestSimilarity = 0;
      
      for (const helpItem of helpDatabase) {
        const helpEmbedding = await this.generateEmbedding(helpItem.context);
        const similarity = this.calculateCosineSimilarity(
          contextEmbedding.vector,
          helpEmbedding.vector
        );
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = helpItem.help;
        }
      }
      
      return bestMatch || 'No specific help available for this field.';
    } catch (error) {
      console.error('Error getting contextual help:', error);
      return 'Help system temporarily unavailable.';
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      console.warn('Vector length mismatch in similarity calculation');
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Perform heuristic fraud detection
   */
  private performHeuristicFraudCheck(text: string): number {
    let score = 0;
    const lowerText = text.toLowerCase();
    
    // Check for common fraud indicators
    const fraudPhrases = [
      'congratulations you have won',
      'urgent action required',
      'verify your account',
      'suspend your account',
      'click here immediately',
      'limited time offer',
      'act now',
      'send money',
      'wire transfer',
      'processing fee',
      'refundable deposit'
    ];
    
    fraudPhrases.forEach(phrase => {
      if (lowerText.includes(phrase)) {
        score += 0.2;
      }
    });
    
    // Check for suspicious patterns
    if (text.match(/\$[\d,]+\.?\d*\s+(million|thousand)/gi)) {
      score += 0.3;
    }
    
    if (text.match(/\b\d{16}\b/g)) { // Credit card numbers
      score += 0.4;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Get reasons for heuristic fraud detection
   */
  private getHeuristicReasons(text: string): string[] {
    const reasons: string[] = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('congratulations you have won')) {
      reasons.push('Contains lottery/prize scam language');
    }
    
    if (lowerText.includes('urgent action required') || lowerText.includes('act now')) {
      reasons.push('Uses urgent language typical of scams');
    }
    
    if (lowerText.includes('verify your account') || lowerText.includes('suspend your account')) {
      reasons.push('Requests account verification (phishing indicator)');
    }
    
    if (text.match(/\$[\d,]+\.?\d*\s+(million|thousand)/gi)) {
      reasons.push('Mentions large sums of money');
    }
    
    return reasons.length > 0 ? reasons : ['Exhibits suspicious characteristics'];
  }

  /**
   * Load known fraud patterns
   */
  private async loadFraudPatterns(): Promise<void> {
    try {
      // Sample fraud patterns - in production, load from database
      const fraudExamples = [
        {
          text: 'Congratulations! You have won $1 million. Send processing fee to claim prize.',
          reason: 'Lottery/prize scam pattern'
        },
        {
          text: 'Your account will be suspended. Click here to verify immediately.',
          reason: 'Phishing attempt pattern'
        },
        {
          text: 'Urgent: Wire $500 processing fee to receive your immigration documents.',
          reason: 'Immigration fee scam pattern'
        }
      ];
      
      for (const example of fraudExamples) {
        const embedding = await this.generateEmbedding(example.text);
        embedding.metadata.reason = example.reason;
        this.fraudPatterns.push(embedding);
      }
    } catch (error) {
      console.error('Error loading fraud patterns:', error);
    }
  }

  /**
   * Get help database for contextual assistance
   */
  private getHelpDatabase() {
    return [
      {
        context: 'full name legal name',
        help: 'Enter your full legal name as it appears on your passport or birth certificate.'
      },
      {
        context: 'alien number a-number',
        help: 'Your A-Number is the unique identifier assigned by USCIS. It can be found on your green card, work authorization document, or previous USCIS correspondence.'
      },
      {
        context: 'receipt number',
        help: 'The receipt number is a 13-character identifier starting with letters followed by numbers, found on your USCIS receipt notice.'
      },
      {
        context: 'date of birth birth date',
        help: 'Enter your date of birth in MM/DD/YYYY format as it appears on your passport.'
      },
      {
        context: 'country of birth',
        help: 'Enter the country where you were born, not your current citizenship.'
      }
    ];
  }

  /**
   * Store document embedding for future searches
   */
  async storeDocumentEmbedding(id: string, text: string, metadata?: any): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(text, id);
      if (metadata) {
        embedding.metadata = { ...embedding.metadata, ...metadata };
      }
      this.documentEmbeddings.set(id, embedding);
    } catch (error) {
      console.error('Error storing document embedding:', error);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      // Cleanup TensorFlow.js tensors and resources
      tf.disposeVariables();
      this.documentEmbeddings.clear();
      this.fraudPatterns = [];
    } catch (error) {
      console.error('Error during embeddings cleanup:', error);
    }
  }
}