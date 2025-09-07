/**
 * Mail Processor Service
 * Orchestrates the complete mail processing pipeline:
 * OCR → Language Detection → Translation → Classification → Information Extraction → Summarization
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../utils/logger';
import { DatabaseService } from './DatabaseService';
import { ClassificationService } from './ClassificationService';
import { ExtractionService } from './ExtractionService';
import { SummarizationService } from './SummarizationService';
import { RiskAnalysisService } from './RiskAnalysisService';

import type {
  MailJob,
  ProcessingOptions,
  OCRResult,
  LanguageDetectionResult,
  TranslationResult,
  DocumentClassificationResult,
  ExtractedInfo,
  SummaryResult,
  ActionExtraction,
  RiskAnalysis
} from '../models/types';

export class MailProcessorService {
  private dbService: DatabaseService;
  private classificationService: ClassificationService;
  private extractionService: ExtractionService;
  private summarizationService: SummarizationService;
  private riskAnalysisService: RiskAnalysisService;

  // Service endpoints
  private readonly OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://ocr:8000';
  private readonly MT_GATEWAY_URL = process.env.MT_GATEWAY_URL || 'http://mt-gateway:7001';
  private readonly EMBED_SERVICE_URL = process.env.EMBED_SERVICE_URL || 'http://embed-service:3011';

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
    this.classificationService = new ClassificationService(this.EMBED_SERVICE_URL, dbService);
    this.extractionService = new ExtractionService();
    this.summarizationService = new SummarizationService();
    this.riskAnalysisService = new RiskAnalysisService();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize sub-services
      await this.classificationService.initialize();
      
      // Test connectivity to external services
      await this.checkServiceHealth();
      
      logger.info('Mail processor service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize mail processor:', error);
      throw error;
    }
  }

  /**
   * Process a mail document through the complete pipeline
   */
  async processMailDocument(
    jobId: string,
    filePath: string,
    options: ProcessingOptions = {}
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting mail processing for job ${jobId}`, { filePath, options });

      // Update job status
      await this.updateJobStatus(jobId, 'processing');
      
      // Step 1: OCR - Extract text from document
      const ocrResult = await this.performOCR(jobId, filePath);
      
      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        throw new Error('No text extracted from document - document may be empty or corrupted');
      }

      // Step 2: Language Detection
      const languageResult = await this.detectLanguage(ocrResult.text);
      
      // Step 3: Translation (if needed)
      let translationResult: TranslationResult | null = null;
      if (!options.skip_translation && languageResult.language !== 'en') {
        translationResult = await this.translateText(
          ocrResult.text,
          languageResult.language,
          'en',
          options.translation_provider
        );
      }

      // Use English text for further processing
      const englishText = translationResult?.translated_text || ocrResult.text;

      // Step 4: Document Classification
      const classificationResult = await this.classifyDocument(englishText);

      // Step 5: Information Extraction
      const extractedInfo = await this.extractInformation(englishText, classificationResult.doc_type);

      // Step 6: Risk Analysis (if enabled)
      let riskAnalysis: RiskAnalysis | null = null;
      if (options.include_risk_analysis !== false) {
        riskAnalysis = await this.analyzeRisks(englishText, extractedInfo, classificationResult.doc_type);
      }

      // Step 7: Summarization
      let summaryResult: SummaryResult | null = null;
      if (options.generate_summary !== false) {
        summaryResult = await this.generateSummary(
          englishText,
          extractedInfo,
          classificationResult.doc_type,
          options.user_language || 'en'
        );
      }

      // Step 8: Action Extraction
      let actionExtraction: ActionExtraction | null = null;
      if (options.extract_actions !== false) {
        actionExtraction = await this.extractActions(
          englishText,
          extractedInfo,
          classificationResult.doc_type
        );
      }

      // Step 9: Save results to database
      await this.saveProcessingResults(jobId, {
        ocrResult,
        languageResult,
        translationResult,
        classificationResult,
        extractedInfo,
        summaryResult,
        actionExtraction,
        riskAnalysis
      });

      // Update job status
      await this.updateJobStatus(jobId, 'ready', Date.now() - startTime);
      
      logger.info(`Mail processing completed for job ${jobId}`, {
        processingTime: Date.now() - startTime,
        docType: classificationResult.doc_type,
        confidence: classificationResult.confidence
      });

    } catch (error) {
      logger.error(`Mail processing failed for job ${jobId}:`, error);
      
      // Log error to audit trail
      await this.logProcessingStep(jobId, 'pipeline', 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      });

      // Update job status
      await this.updateJobStatus(jobId, 'error');
      
      throw error;
    }
  }

  /**
   * Perform OCR on document
   */
  private async performOCR(jobId: string, filePath: string): Promise<OCRResult> {
    const stepStart = Date.now();
    
    try {
      logger.info(`Starting OCR for job ${jobId}`);

      const formData = new FormData();
      const fileStream = await fs.readFile(filePath);
      formData.append('file', fileStream, path.basename(filePath));

      const response = await axios.post(`${this.OCR_SERVICE_URL}/api/ocr/extract`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minutes
      });

      const result: OCRResult = {
        text: response.data.text || '',
        confidence: response.data.confidence || 0.5,
        blocks: response.data.blocks || [],
        layout_preserved: response.data.layout_preserved || false
      };

      await this.logProcessingStep(jobId, 'ocr', 'completed', {
        textLength: result.text.length,
        confidence: result.confidence,
        processingTime: Date.now() - stepStart
      });

      return result;

    } catch (error) {
      await this.logProcessingStep(jobId, 'ocr', 'failed', {
        error: error instanceof Error ? error.message : 'OCR failed',
        processingTime: Date.now() - stepStart
      });
      throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect document language
   */
  private async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    try {
      // Use simple heuristic detection for common languages
      const textSample = text.slice(0, 1000).toLowerCase();
      
      // Common language indicators
      const languagePatterns = {
        es: /\b(el|la|los|las|un|una|de|del|en|con|por|para|que|se|no|es|son|está|están)\b/g,
        fr: /\b(le|la|les|un|une|de|du|des|et|est|sont|avec|pour|que|se|ne|pas)\b/g,
        ar: /[\u0600-\u06FF]/g,
        en: /\b(the|and|or|of|in|on|at|to|for|with|by|from|is|are|was|were)\b/g
      };

      const scores = {
        en: (textSample.match(languagePatterns.en) || []).length,
        es: (textSample.match(languagePatterns.es) || []).length,
        fr: (textSample.match(languagePatterns.fr) || []).length,
        ar: (textSample.match(languagePatterns.ar) || []).length
      };

      const maxScore = Math.max(...Object.values(scores));
      const detectedLang = Object.keys(scores).find(lang => scores[lang as keyof typeof scores] === maxScore) || 'en';
      
      const confidence = maxScore > 0 ? Math.min(maxScore / 50, 1) : 0.3;

      return {
        language: detectedLang,
        confidence,
        alternatives: Object.entries(scores)
          .filter(([lang]) => lang !== detectedLang)
          .map(([lang, score]) => ({
            language: lang,
            confidence: score > 0 ? Math.min(score / 50, 1) : 0
          }))
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 2)
      };

    } catch (error) {
      logger.warn('Language detection failed, defaulting to English:', error);
      return {
        language: 'en',
        confidence: 0.3,
        alternatives: []
      };
    }
  }

  /**
   * Translate text using MT Gateway
   */
  private async translateText(
    text: string,
    sourceLang: string,
    targetLang: string,
    provider?: string
  ): Promise<TranslationResult> {
    try {
      logger.info(`Translating text from ${sourceLang} to ${targetLang}`);

      const response = await axios.post(`${this.MT_GATEWAY_URL}/translate`, {
        text,
        source_language: sourceLang,
        target_language: targetLang,
        provider: provider || 'libre'
      }, {
        timeout: 60000 // 1 minute
      });

      return {
        translated_text: response.data.translated_text,
        source_language: sourceLang,
        target_language: targetLang,
        confidence: response.data.confidence || 0.8,
        provider: response.data.provider || 'libre'
      };

    } catch (error) {
      logger.error('Translation failed:', error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Classify document type
   */
  private async classifyDocument(text: string): Promise<DocumentClassificationResult> {
    try {
      return await this.classificationService.classifyDocument(text);
    } catch (error) {
      logger.error('Document classification failed:', error);
      // Return default classification
      return {
        doc_type: 'other',
        confidence: 0.1,
        matched_keywords: [],
        fallback_used: true
      };
    }
  }

  /**
   * Extract structured information
   */
  private async extractInformation(text: string, docType: string): Promise<ExtractedInfo> {
    try {
      return await this.extractionService.extractInformation(text, docType);
    } catch (error) {
      logger.error('Information extraction failed:', error);
      return {};
    }
  }

  /**
   * Generate summary
   */
  private async generateSummary(
    text: string,
    extractedInfo: ExtractedInfo,
    docType: string,
    userLanguage: string
  ): Promise<SummaryResult> {
    try {
      return await this.summarizationService.generateSummary(text, extractedInfo, docType, userLanguage);
    } catch (error) {
      logger.error('Summary generation failed:', error);
      return {
        summary: 'Unable to generate summary for this document.',
        key_points: [],
        action_items: [],
        urgency_level: 'medium'
      };
    }
  }

  /**
   * Extract actionable items
   */
  private async extractActions(
    text: string,
    extractedInfo: ExtractedInfo,
    docType: string
  ): Promise<ActionExtraction> {
    try {
      return await this.extractionService.extractActions(text, extractedInfo, docType);
    } catch (error) {
      logger.error('Action extraction failed:', error);
      return {
        actions: [],
        deadline_urgency: 'safe'
      };
    }
  }

  /**
   * Analyze document for risks and scams
   */
  private async analyzeRisks(
    text: string,
    extractedInfo: ExtractedInfo,
    docType: string
  ): Promise<RiskAnalysis> {
    try {
      return await this.riskAnalysisService.analyzeRisks(text, extractedInfo, docType);
    } catch (error) {
      logger.error('Risk analysis failed:', error);
      return {
        is_suspicious: false,
        risk_factors: [],
        scam_indicators: [],
        authenticity_markers: [],
        recommendation: 'proceed',
        risk_score: 0
      };
    }
  }

  /**
   * Save all processing results to database
   */
  private async saveProcessingResults(jobId: string, results: any): Promise<void> {
    const client = await this.dbService.getClient();
    
    try {
      await client.query('BEGIN');

      // Update main job record
      const updateQuery = `
        UPDATE mail_jobs 
        SET 
          detected_lang = $1,
          doc_type = $2,
          summary_en = $3,
          summary_user = $4,
          due_date = $5,
          amount = $6,
          case_or_account_number = $7,
          risk_flags = $8,
          confidence_scores = $9,
          processed_at = NOW()
        WHERE id = $10
      `;

      await client.query(updateQuery, [
        results.languageResult.language,
        results.classificationResult.doc_type,
        results.summaryResult?.summary,
        results.summaryResult?.summary, // For now, same as English
        results.extractedInfo.dates?.due_date,
        results.extractedInfo.amounts?.total_due,
        results.extractedInfo.identifiers?.case_number || 
        results.extractedInfo.identifiers?.account_number ||
        results.extractedInfo.identifiers?.claim_number,
        JSON.stringify(results.riskAnalysis ? {
          potential_scam: results.riskAnalysis.is_suspicious,
          risk_score: results.riskAnalysis.risk_score
        } : {}),
        JSON.stringify({
          ocr_quality: results.ocrResult.confidence,
          language_detection: results.languageResult.confidence,
          document_classification: results.classificationResult.confidence,
          overall_confidence: (
            results.ocrResult.confidence +
            results.languageResult.confidence +
            results.classificationResult.confidence
          ) / 3
        }),
        jobId
      ]);

      // Insert extracted actions
      if (results.actionExtraction?.actions?.length > 0) {
        for (const action of results.actionExtraction.actions) {
          await client.query(`
            INSERT INTO mail_actions (mail_job_id, label, description, due_at, priority, action_type, meta)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            jobId,
            action.label,
            action.description,
            action.due_date,
            action.priority,
            action.action_type,
            JSON.stringify({ confidence: action.confidence, context: action.context })
          ]);
        }
      }

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: string, status: string, processingTime?: number): Promise<void> {
    const client = await this.dbService.getClient();
    
    try {
      await client.query(`
        UPDATE mail_jobs 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `, [status, jobId]);
      
      if (processingTime) {
        await this.logProcessingStep(jobId, 'pipeline', 'completed', { processingTime });
      }
      
    } catch (error) {
      logger.error('Failed to update job status:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Log processing step to audit trail
   */
  private async logProcessingStep(
    jobId: string,
    step: string,
    status: string,
    data?: any
  ): Promise<void> {
    const client = await this.dbService.getClient();
    
    try {
      await client.query(`
        INSERT INTO mail_audit (mail_job_id, step, status, processing_time_ms, output_data)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        jobId,
        step,
        status,
        data?.processingTime || null,
        data ? JSON.stringify(data) : null
      ]);
    } catch (error) {
      logger.warn('Failed to log processing step:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Check health of external services
   */
  private async checkServiceHealth(): Promise<void> {
    const services = [
      { name: 'OCR Service', url: `${this.OCR_SERVICE_URL}/health` },
      { name: 'MT Gateway', url: `${this.MT_GATEWAY_URL}/health` },
      { name: 'Embed Service', url: `${this.EMBED_SERVICE_URL}/health` }
    ];

    for (const service of services) {
      try {
        const response = await axios.get(service.url, { timeout: 5000 });
        if (response.status === 200) {
          logger.info(`${service.name} is healthy`);
        } else {
          logger.warn(`${service.name} returned status ${response.status}`);
        }
      } catch (error) {
        logger.warn(`${service.name} health check failed:`, error);
        // Don't fail initialization for external service issues
      }
    }
  }
}