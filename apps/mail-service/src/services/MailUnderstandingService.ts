import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { SummarizationService } from './SummarizationService';
import { ClassificationService } from './ClassificationService';
import { IntegrationService } from './IntegrationService';

export interface DocumentAnalysis {
  id: string;
  filename: string;
  type: 'pdf' | 'docx' | 'image' | 'text';
  extractedText: string;
  translatedText?: string;
  summary: string;
  classification: {
    documentType: string;
    sender: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    category: 'uscis' | 'insurance' | 'bank' | 'legal' | 'other';
  };
  actionItems: ActionItem[];
  keyDates: KeyDate[];
  analysis: {
    language: string;
    confidence: number;
    fraudScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    isOfficialDocument: boolean;
  };
  processedAt: Date;
}

export interface ActionItem {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  category: 'response_required' | 'document_needed' | 'payment_due' | 'appointment' | 'information';
  completed: boolean;
}

export interface KeyDate {
  id: string;
  date: Date;
  type: 'deadline' | 'appointment' | 'expiration' | 'notification';
  description: string;
  daysFromNow: number;
}

export interface TranslationRequest {
  text: string;
  fromLanguage: string;
  toLanguage: string;
}

export class MailUnderstandingService {
  private summarizationService: SummarizationService;
  private classificationService: ClassificationService;
  private integrationService: IntegrationService;
  private ocrWorker: any;

  constructor() {
    this.summarizationService = new SummarizationService();
    this.classificationService = new ClassificationService();
    this.integrationService = new IntegrationService();
    this.initializeOCR();
  }

  private async initializeOCR(): Promise<void> {
    try {
      this.ocrWorker = createWorker({
        logger: (m) => console.log('OCR:', m)
      });
      
      await this.ocrWorker.load();
      await this.ocrWorker.loadLanguage('eng+spa+ara+fra');
      await this.ocrWorker.initialize('eng+spa+ara+fra');
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
    }
  }

  /**
   * Comprehensive document understanding and analysis
   */
  async understandDocument(fileBuffer: Buffer, filename: string): Promise<DocumentAnalysis> {
    try {
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Step 1: Extract text based on file type
      const { extractedText, type } = await this.extractTextFromDocument(fileBuffer, filename);
      
      // Step 2: Detect language
      const language = await this.detectLanguage(extractedText);
      
      // Step 3: Translate if not English
      let translatedText: string | undefined;
      if (language !== 'en' && extractedText.length > 0) {
        translatedText = await this.translateText({
          text: extractedText,
          fromLanguage: language,
          toLanguage: 'en'
        });
      }

      // Step 4: Classify document
      const textForAnalysis = translatedText || extractedText;
      const classification = await this.classifyDocument(textForAnalysis);
      
      // Step 5: Generate summary
      const summary = await this.generateSummary(textForAnalysis);
      
      // Step 6: Extract action items and key dates
      const actionItems = await this.extractActionItems(textForAnalysis);
      const keyDates = await this.extractKeyDates(textForAnalysis);
      
      // Step 7: Perform risk analysis
      const analysis = await this.performRiskAnalysis(textForAnalysis, classification);

      const documentAnalysis: DocumentAnalysis = {
        id: documentId,
        filename,
        type,
        extractedText,
        translatedText,
        summary,
        classification,
        actionItems,
        keyDates,
        analysis: {
          ...analysis,
          language
        },
        processedAt: new Date()
      };

      return documentAnalysis;
    } catch (error) {
      console.error('Error in document understanding:', error);
      throw new Error(`Failed to understand document: ${error.message}`);
    }
  }

  /**
   * Extract text from various document types
   */
  private async extractTextFromDocument(fileBuffer: Buffer, filename: string): Promise<{ extractedText: string; type: 'pdf' | 'docx' | 'image' | 'text' }> {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    try {
      switch (extension) {
        case 'pdf':
          const pdfResult = await pdfParse(fileBuffer);
          return { extractedText: pdfResult.text, type: 'pdf' };
          
        case 'docx':
        case 'doc':
          const docxResult = await mammoth.extractRawText({ buffer: fileBuffer });
          return { extractedText: docxResult.value, type: 'docx' };
          
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'tiff':
        case 'bmp':
          if (!this.ocrWorker) {
            await this.initializeOCR();
          }
          const { data: { text } } = await this.ocrWorker.recognize(fileBuffer);
          return { extractedText: text, type: 'image' };
          
        case 'txt':
          return { extractedText: fileBuffer.toString('utf-8'), type: 'text' };
          
        default:
          // Try OCR as fallback
          if (!this.ocrWorker) {
            await this.initializeOCR();
          }
          const { data: { text: ocrText } } = await this.ocrWorker.recognize(fileBuffer);
          return { extractedText: ocrText, type: 'image' };
      }
    } catch (error) {
      console.error(`Error extracting text from ${extension} file:`, error);
      throw new Error(`Failed to extract text from ${extension} file`);
    }
  }

  /**
   * Detect document language
   */
  private async detectLanguage(text: string): Promise<string> {
    try {
      const langdetect = require('langdetect');
      const detectedLanguages = langdetect.detect(text);
      return detectedLanguages.length > 0 ? detectedLanguages[0].lang : 'en';
    } catch (error) {
      console.error('Language detection failed:', error);
      return 'en'; // Default to English
    }
  }

  /**
   * Translate text using external translation service
   */
  async translateText(request: TranslationRequest): Promise<string> {
    try {
      const response = await this.integrationService.translateText(
        request.text,
        request.fromLanguage,
        request.toLanguage
      );
      return response.translatedText;
    } catch (error) {
      console.error('Translation failed:', error);
      return request.text; // Return original text if translation fails
    }
  }

  /**
   * Classify document using existing classification service
   */
  private async classifyDocument(text: string) {
    try {
      const classification = await this.classificationService.classifyDocument({
        text,
        metadata: {}
      });
      
      // Enhanced classification for immigration documents
      const category = this.determineDocumentCategory(text);
      const urgency = this.determineUrgency(text);
      const sender = this.extractSender(text);
      
      return {
        documentType: classification.type || 'unknown',
        sender,
        urgency,
        category
      };
    } catch (error) {
      console.error('Document classification failed:', error);
      return {
        documentType: 'unknown',
        sender: 'unknown',
        urgency: 'medium' as const,
        category: 'other' as const
      };
    }
  }

  /**
   * Determine document category based on content analysis
   */
  private determineDocumentCategory(text: string): 'uscis' | 'insurance' | 'bank' | 'legal' | 'other' {
    const lowerText = text.toLowerCase();
    
    const uscisKeywords = ['uscis', 'immigration', 'green card', 'visa', 'naturalization', 'citizenship', 'i-94', 'form i-'];
    const insuranceKeywords = ['insurance', 'policy', 'coverage', 'premium', 'claim', 'deductible'];
    const bankKeywords = ['bank', 'account', 'credit', 'loan', 'mortgage', 'statement', 'balance'];
    const legalKeywords = ['court', 'legal', 'attorney', 'lawsuit', 'subpoena', 'hearing'];
    
    if (uscisKeywords.some(keyword => lowerText.includes(keyword))) return 'uscis';
    if (insuranceKeywords.some(keyword => lowerText.includes(keyword))) return 'insurance';
    if (bankKeywords.some(keyword => lowerText.includes(keyword))) return 'bank';
    if (legalKeywords.some(keyword => lowerText.includes(keyword))) return 'legal';
    
    return 'other';
  }

  /**
   * Determine document urgency
   */
  private determineUrgency(text: string): 'low' | 'medium' | 'high' | 'critical' {
    const lowerText = text.toLowerCase();
    
    const criticalKeywords = ['urgent', 'immediate', 'deadline', 'expir', 'final notice', 'legal action'];
    const highKeywords = ['important', 'asap', 'respond by', 'due date', 'required by'];
    const mediumKeywords = ['please respond', 'action needed', 'review', 'update'];
    
    if (criticalKeywords.some(keyword => lowerText.includes(keyword))) return 'critical';
    if (highKeywords.some(keyword => lowerText.includes(keyword))) return 'high';
    if (mediumKeywords.some(keyword => lowerText.includes(keyword))) return 'medium';
    
    return 'low';
  }

  /**
   * Extract sender information from document
   */
  private extractSender(text: string): string {
    try {
      // Look for common sender patterns
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Check first few lines for sender information
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i];
        if (line.includes('U.S. Citizenship and Immigration Services') || line.includes('USCIS')) {
          return 'USCIS';
        }
        if (line.match(/bank|credit union/i)) {
          return line.length < 100 ? line : 'Bank';
        }
        if (line.match(/insurance/i)) {
          return line.length < 100 ? line : 'Insurance Company';
        }
      }
      
      return lines[0] || 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Generate document summary
   */
  private async generateSummary(text: string): Promise<string> {
    try {
      const summary = await this.summarizationService.generateSummary({
        text,
        type: 'document'
      });
      return summary.summary;
    } catch (error) {
      console.error('Summary generation failed:', error);
      // Fallback to simple truncation
      return text.length > 500 ? text.substring(0, 497) + '...' : text;
    }
  }

  /**
   * Extract actionable items from document
   */
  private async extractActionItems(text: string): Promise<ActionItem[]> {
    const actionItems: ActionItem[] = [];
    const lowerText = text.toLowerCase();
    
    try {
      // Pattern matching for common action items
      const actionPatterns = [
        {
          pattern: /please (respond|reply|contact|call|submit|send|provide|complete)([^.]{0,100})/gi,
          category: 'response_required' as const,
          priority: 'medium' as const
        },
        {
          pattern: /you must (submit|provide|send|complete|file|pay)([^.]{0,100})/gi,
          category: 'document_needed' as const,
          priority: 'high' as const
        },
        {
          pattern: /(payment|fee|amount) (?:of|is|due)([^.]{0,100})/gi,
          category: 'payment_due' as const,
          priority: 'high' as const
        },
        {
          pattern: /(appointment|interview|hearing|meeting)([^.]{0,100})/gi,
          category: 'appointment' as const,
          priority: 'high' as const
        }
      ];

      actionPatterns.forEach((pattern, index) => {
        const matches = text.match(pattern.pattern);
        if (matches) {
          matches.forEach((match, matchIndex) => {
            actionItems.push({
              id: `action_${index}_${matchIndex}_${Date.now()}`,
              description: match.trim(),
              priority: pattern.priority,
              category: pattern.category,
              completed: false,
              dueDate: this.extractDueDateFromText(match)
            });
          });
        }
      });

      return actionItems.slice(0, 10); // Limit to 10 most relevant action items
    } catch (error) {
      console.error('Action item extraction failed:', error);
      return [];
    }
  }

  /**
   * Extract key dates from document
   */
  private async extractKeyDates(text: string): Promise<KeyDate[]> {
    const keyDates: KeyDate[] = [];
    
    try {
      // Common date patterns
      const datePatterns = [
        /(?:deadline|due date|expires?|expiration)(?::\s*|\s+(?:is|on|by)\s+)(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/gi,
        /(?:appointment|interview|hearing)(?::\s*|\s+(?:is|on|at)\s+)(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/gi,
        /(?:before|by|not later than)\s+(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/gi
      ];

      datePatterns.forEach((pattern, index) => {
        const matches = Array.from(text.matchAll(pattern));
        matches.forEach((match, matchIndex) => {
          const dateStr = match[1];
          const parsedDate = this.parseDate(dateStr);
          
          if (parsedDate) {
            const now = new Date();
            const daysFromNow = Math.ceil((parsedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            keyDates.push({
              id: `date_${index}_${matchIndex}_${Date.now()}`,
              date: parsedDate,
              type: this.determineDateType(match[0]),
              description: match[0].trim(),
              daysFromNow
            });
          }
        });
      });

      return keyDates.sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch (error) {
      console.error('Key date extraction failed:', error);
      return [];
    }
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateStr: string): Date | null {
    try {
      // Handle various date formats
      let parsedDate = new Date(dateStr);
      
      if (isNaN(parsedDate.getTime())) {
        // Try parsing MM/DD/YYYY format
        const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (match) {
          parsedDate = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
        }
      }
      
      return isNaN(parsedDate.getTime()) ? null : parsedDate;
    } catch (error) {
      return null;
    }
  }

  /**
   * Determine the type of date based on context
   */
  private determineDateType(context: string): 'deadline' | 'appointment' | 'expiration' | 'notification' {
    const lowerContext = context.toLowerCase();
    
    if (lowerContext.includes('appointment') || lowerContext.includes('interview') || lowerContext.includes('hearing')) {
      return 'appointment';
    }
    if (lowerContext.includes('deadline') || lowerContext.includes('due')) {
      return 'deadline';
    }
    if (lowerContext.includes('expir')) {
      return 'expiration';
    }
    
    return 'notification';
  }

  /**
   * Extract due date from action item text
   */
  private extractDueDateFromText(text: string): Date | undefined {
    try {
      const dateMatch = text.match(/(?:by|before|until|due)\s+(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
      if (dateMatch) {
        const parsedDate = this.parseDate(dateMatch[1]);
        return parsedDate || undefined;
      }
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Perform comprehensive risk analysis
   */
  private async performRiskAnalysis(text: string, classification: any): Promise<{ 
    confidence: number; 
    fraudScore: number; 
    riskLevel: 'low' | 'medium' | 'high'; 
    isOfficialDocument: boolean 
  }> {
    try {
      // Use existing risk analysis service if available
      const riskAnalysis = {
        confidence: this.calculateConfidence(text, classification),
        fraudScore: await this.calculateFraudScore(text),
        riskLevel: 'low' as 'low' | 'medium' | 'high',
        isOfficialDocument: this.isOfficialDocument(text)
      };

      // Determine risk level based on fraud score
      if (riskAnalysis.fraudScore > 0.7) riskAnalysis.riskLevel = 'high';
      else if (riskAnalysis.fraudScore > 0.4) riskAnalysis.riskLevel = 'medium';

      return riskAnalysis;
    } catch (error) {
      console.error('Risk analysis failed:', error);
      return {
        confidence: 0.5,
        fraudScore: 0.0,
        riskLevel: 'low',
        isOfficialDocument: false
      };
    }
  }

  /**
   * Calculate confidence score for document analysis
   */
  private calculateConfidence(text: string, classification: any): number {
    // Simple confidence calculation based on text quality and classification certainty
    const textQuality = text.length > 100 ? 0.8 : text.length / 125;
    const classificationConfidence = classification.documentType !== 'unknown' ? 0.9 : 0.3;
    
    return Math.min((textQuality + classificationConfidence) / 2, 1.0);
  }

  /**
   * Calculate fraud score based on document characteristics
   */
  private async calculateFraudScore(text: string): Promise<number> {
    let fraudScore = 0.0;
    const lowerText = text.toLowerCase();
    
    // Check for common fraud indicators
    const fraudIndicators = [
      'urgent transfer required',
      'send money immediately',
      'verify account information',
      'suspended account',
      'click here now',
      'congratulations you have won'
    ];

    fraudIndicators.forEach(indicator => {
      if (lowerText.includes(indicator)) {
        fraudScore += 0.2;
      }
    });

    // Check for suspicious patterns
    if (text.match(/\$[\d,]+\.?\d*\s+(million|thousand)/gi)) {
      fraudScore += 0.1;
    }

    return Math.min(fraudScore, 1.0);
  }

  /**
   * Determine if document appears to be official
   */
  private isOfficialDocument(text: string): boolean {
    const officialIndicators = [
      'U.S. Citizenship and Immigration Services',
      'USCIS',
      'Department of Homeland Security',
      'Official Use Only',
      'Form I-',
      'Receipt Number',
      'Case Number',
      'A-Number'
    ];

    return officialIndicators.some(indicator => 
      text.includes(indicator)
    );
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.ocrWorker) {
        await this.ocrWorker.terminate();
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}