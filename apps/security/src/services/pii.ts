import nlp from 'compromise';
import { PIIDetectionResult, PIIMatch, PIIType, SecurityConfig } from '../types';
import { logger } from '../utils/logger';

export class PIIService {
  private config: SecurityConfig;
  
  // Regex patterns for PII detection
  private patterns: Map<PIIType, RegExp> = new Map([
    ['ssn', /\b(?:\d{3}-?\d{2}-?\d{4}|\d{9})\b/g],
    ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
    ['phone', /\b(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g],
    ['credit_card', /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g],
    ['alien_number', /\b(?:A\d{8,9}|\d{8,9})\b/g],
    ['date_of_birth', /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g],
    ['drivers_license', /\b[A-Z]{1,2}\d{6,8}\b/g],
    ['passport', /\b[A-Z]{2}\d{7}\b/g],
    ['bank_account', /\b\d{8,17}\b/g]
  ]);

  // Common first and last names for name detection
  private commonNames = new Set([
    'john', 'jane', 'michael', 'sarah', 'david', 'lisa', 'james', 'maria',
    'robert', 'jennifer', 'william', 'patricia', 'richard', 'linda', 'joseph',
    'elizabeth', 'thomas', 'barbara', 'christopher', 'susan', 'daniel', 'jessica',
    'matthew', 'karen', 'anthony', 'nancy', 'mark', 'betty', 'donald', 'helen'
  ]);

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async detectPII(text: string): Promise<PIIDetectionResult> {
    try {
      const detectedPII: PIIMatch[] = [];
      let maskedText = text;
      let overallConfidence = 0;

      // Detect pattern-based PII
      for (const [type, pattern] of this.patterns) {
        const matches = text.matchAll(pattern);
        
        for (const match of matches) {
          if (match.index !== undefined) {
            const value = match[0];
            const confidence = this.calculateConfidence(type, value);
            
            if (confidence >= this.getMinimumConfidence()) {
              const masked = this.maskValue(type, value);
              
              detectedPII.push({
                type,
                value,
                start: match.index,
                end: match.index + value.length,
                confidence,
                masked
              });

              // Replace in masked text
              maskedText = maskedText.replace(value, masked);
              overallConfidence += confidence;
            }
          }
        }
      }

      // Detect names using NLP
      const nameMatches = this.detectNames(text);
      for (const nameMatch of nameMatches) {
        detectedPII.push(nameMatch);
        maskedText = maskedText.replace(nameMatch.value, nameMatch.masked);
        overallConfidence += nameMatch.confidence;
      }

      // Detect addresses using patterns and NLP
      const addressMatches = this.detectAddresses(text);
      for (const addressMatch of addressMatches) {
        detectedPII.push(addressMatch);
        maskedText = maskedText.replace(addressMatch.value, addressMatch.masked);
        overallConfidence += addressMatch.confidence;
      }

      // Calculate overall confidence
      if (detectedPII.length > 0) {
        overallConfidence = Math.min(overallConfidence / detectedPII.length, 1.0);
      }

      const result: PIIDetectionResult = {
        text,
        maskedText,
        detectedPII,
        confidence: overallConfidence,
        timestamp: new Date()
      };

      logger.debug('PII detection completed', {
        originalLength: text.length,
        detectedCount: detectedPII.length,
        confidence: overallConfidence
      });

      return result;

    } catch (error: any) {
      logger.error('PII detection error:', error);
      
      return {
        text,
        maskedText: text,
        detectedPII: [],
        confidence: 0,
        timestamp: new Date()
      };
    }
  }

  private detectNames(text: string): PIIMatch[] {
    const matches: PIIMatch[] = [];
    
    try {
      const doc = nlp(text);
      const people = doc.people().out('array');
      
      for (const person of people) {
        const personLower = person.toLowerCase();
        const words = personLower.split(' ');
        
        // Check if any word is a common name
        const hasCommonName = words.some(word => this.commonNames.has(word));
        
        if (hasCommonName || words.length >= 2) {
          const startIndex = text.toLowerCase().indexOf(personLower);
          
          if (startIndex !== -1) {
            matches.push({
              type: 'name',
              value: person,
              start: startIndex,
              end: startIndex + person.length,
              confidence: hasCommonName ? 0.8 : 0.6,
              masked: this.maskValue('name', person)
            });
          }
        }
      }
    } catch (error) {
      // NLP processing failed, fall back to simple name detection
      logger.debug('NLP name detection failed, using fallback');
    }

    return matches;
  }

  private detectAddresses(text: string): PIIMatch[] {
    const matches: PIIMatch[] = [];
    
    // Common address patterns
    const addressPatterns = [
      /\b\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Place|Pl)\b/gi,
      /\bP\.?O\.?\s+Box\s+\d+\b/gi,
      /\b\d{5}(?:-\d{4})?\b/g // ZIP codes
    ];

    for (const pattern of addressPatterns) {
      const matches_iter = text.matchAll(pattern);
      
      for (const match of matches_iter) {
        if (match.index !== undefined) {
          const value = match[0];
          
          matches.push({
            type: 'address',
            value,
            start: match.index,
            end: match.index + value.length,
            confidence: 0.7,
            masked: this.maskValue('address', value)
          });
        }
      }
    }

    return matches;
  }

  private calculateConfidence(type: PIIType, value: string): number {
    switch (type) {
      case 'ssn':
        // Higher confidence for properly formatted SSNs
        return /^\d{3}-\d{2}-\d{4}$/.test(value) ? 0.95 : 0.8;
      
      case 'email':
        // Check for valid email structure
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 0.9 : 0.7;
      
      case 'phone':
        // Higher confidence for formatted phone numbers
        return /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/.test(value) ? 0.9 : 0.75;
      
      case 'credit_card':
        // Use Luhn algorithm for credit card validation
        return this.validateCreditCard(value) ? 0.95 : 0.6;
      
      case 'alien_number':
        // A-numbers are typically 8-9 digits with or without 'A' prefix
        return /^A\d{8,9}$/.test(value) ? 0.9 : 0.7;
      
      default:
        return 0.7;
    }
  }

  private validateCreditCard(number: string): boolean {
    // Luhn algorithm implementation
    const digits = number.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  private maskValue(type: PIIType, value: string): string {
    switch (type) {
      case 'ssn':
        return 'XXX-XX-' + value.slice(-4);
      
      case 'email':
        const [local, domain] = value.split('@');
        return local[0] + '***@' + domain;
      
      case 'phone':
        const digits = value.replace(/\D/g, '');
        return '***-***-' + digits.slice(-4);
      
      case 'credit_card':
        const cardDigits = value.replace(/\D/g, '');
        return '**** **** **** ' + cardDigits.slice(-4);
      
      case 'alien_number':
        return 'A********' + value.slice(-1);
      
      case 'name':
        const names = value.split(' ');
        return names.map(name => name[0] + '*'.repeat(Math.max(name.length - 1, 1))).join(' ');
      
      case 'address':
        return '[ADDRESS REDACTED]';
      
      case 'date_of_birth':
        return 'XX/XX/XXXX';
      
      case 'passport':
        return 'XX*****' + value.slice(-1);
      
      case 'drivers_license':
        return 'XX******';
      
      case 'bank_account':
        return '****' + value.slice(-4);
      
      default:
        return '[REDACTED]';
    }
  }

  private getMinimumConfidence(): number {
    const sensitivity = this.config.pii.sensitivity;
    
    switch (sensitivity) {
      case 'high':
        return 0.6;
      case 'medium':
        return 0.7;
      case 'low':
        return 0.8;
      default:
        return 0.7;
    }
  }

  async processBulkText(texts: string[]): Promise<PIIDetectionResult[]> {
    const results: PIIDetectionResult[] = [];
    
    for (const text of texts) {
      const result = await this.detectPII(text);
      results.push(result);
    }
    
    return results;
  }

  // Whitelist specific terms that shouldn't be considered PII
  private whitelist = new Set([
    'john doe', 'jane doe', 'test@example.com', '123-45-6789'
  ]);

  isWhitelisted(value: string): boolean {
    return this.whitelist.has(value.toLowerCase());
  }

  // Statistics for monitoring
  getDetectionStats(): { 
    totalDetections: number; 
    byType: Record<PIIType, number>;
    averageConfidence: number;
  } {
    // In a real implementation, this would query stored statistics
    return {
      totalDetections: 0,
      byType: {} as Record<PIIType, number>,
      averageConfidence: 0
    };
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      // Test PII detection with sample text
      const testText = "Contact John Smith at john.smith@email.com or 555-123-4567";
      const result = await this.detectPII(testText);
      
      const isHealthy = result.detectedPII.length > 0; // Should detect email and phone
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: {
          piiEnabled: this.config.pii.enabled,
          sensitivity: this.config.pii.sensitivity,
          autoMask: this.config.pii.autoMask,
          testDetections: result.detectedPII.length,
          patternsLoaded: this.patterns.size
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message
        }
      };
    }
  }
}