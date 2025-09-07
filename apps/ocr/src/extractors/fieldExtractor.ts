import { OCRResult, WordResult } from '../services/ocr';

export interface ExtractedField {
  field_name: string;
  raw_text: string;
  normalized_value: any;
  confidence: number;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
    page?: number;
  };
  extraction_method: 'pattern_match' | 'position_based' | 'keyword_proximity' | 'ml_inference';
}

export interface ExtractionResult {
  document_type: string;
  fields: ExtractedField[];
  extraction_confidence: number;
  processing_notes: string[];
}

export class FieldExtractor {
  private documentPatterns: Map<string, DocumentPattern>;

  constructor() {
    this.documentPatterns = this.initializePatterns();
  }

  async extractFields(ocrResult: OCRResult, documentType: string): Promise<ExtractionResult> {
    const pattern = this.documentPatterns.get(documentType);
    const processingNotes: string[] = [];

    if (!pattern) {
      processingNotes.push(`No extraction pattern found for document type: ${documentType}`);
      return {
        document_type: documentType,
        fields: [],
        extraction_confidence: 0,
        processing_notes: processingNotes
      };
    }

    const extractedFields: ExtractedField[] = [];
    const allWords = this.getAllWords(ocrResult);

    // Extract fields using different methods
    for (const fieldDef of pattern.fields) {
      const field = await this.extractSingleField(fieldDef, ocrResult.text, allWords);
      if (field) {
        extractedFields.push(field);
      }
    }

    // Post-process and validate extracted fields
    const validatedFields = this.validateAndNormalizeFields(extractedFields, documentType);
    
    // Calculate overall extraction confidence
    const avgConfidence = validatedFields.length > 0 
      ? validatedFields.reduce((sum, f) => sum + f.confidence, 0) / validatedFields.length
      : 0;

    processingNotes.push(`Extracted ${validatedFields.length} fields from ${pattern.fields.length} possible fields`);

    return {
      document_type: documentType,
      fields: validatedFields,
      extraction_confidence: avgConfidence,
      processing_notes: processingNotes
    };
  }

  private async extractSingleField(fieldDef: FieldDefinition, fullText: string, words: WordResult[]): Promise<ExtractedField | null> {
    let extractedValue: string | null = null;
    let confidence = 0;
    let method: ExtractedField['extraction_method'] = 'pattern_match';
    let boundingBox: ExtractedField['bounding_box'] | undefined;

    // Try pattern matching first
    for (const pattern of fieldDef.patterns) {
      const match = fullText.match(new RegExp(pattern.regex, pattern.flags || 'i'));
      if (match) {
        extractedValue = match[pattern.capture_group || 1];
        confidence = pattern.confidence || 0.8;
        method = 'pattern_match';
        break;
      }
    }

    // Try keyword proximity if pattern matching failed
    if (!extractedValue && fieldDef.keywords.length > 0) {
      const proximityResult = this.extractByKeywordProximity(fieldDef, words);
      if (proximityResult) {
        extractedValue = proximityResult.value;
        confidence = proximityResult.confidence;
        boundingBox = proximityResult.boundingBox;
        method = 'keyword_proximity';
      }
    }

    // Try position-based extraction for structured documents
    if (!extractedValue && fieldDef.position_hints) {
      const positionResult = this.extractByPosition(fieldDef, words);
      if (positionResult) {
        extractedValue = positionResult.value;
        confidence = positionResult.confidence;
        boundingBox = positionResult.boundingBox;
        method = 'position_based';
      }
    }

    if (!extractedValue) {
      return null;
    }

    // Normalize the extracted value
    const normalizedValue = this.normalizeFieldValue(fieldDef.field_name, extractedValue);

    return {
      field_name: fieldDef.field_name,
      raw_text: extractedValue,
      normalized_value: normalizedValue,
      confidence,
      bounding_box: boundingBox,
      extraction_method: method
    };
  }

  private extractByKeywordProximity(fieldDef: FieldDefinition, words: WordResult[]): { value: string; confidence: number; boundingBox?: ExtractedField['bounding_box'] } | null {
    for (const keyword of fieldDef.keywords) {
      // Find keyword in words
      const keywordIndex = words.findIndex(word => 
        word.text.toLowerCase().includes(keyword.toLowerCase())
      );

      if (keywordIndex === -1) continue;

      // Look for value in proximity (next few words)
      const proximityRange = 5; // Look within 5 words
      const startIndex = Math.max(0, keywordIndex - proximityRange);
      const endIndex = Math.min(words.length, keywordIndex + proximityRange + 1);
      
      for (let i = startIndex; i < endIndex; i++) {
        if (i === keywordIndex) continue;
        
        const word = words[i];
        if (this.isLikelyFieldValue(fieldDef.field_name, word.text)) {
          return {
            value: word.text,
            confidence: Math.min(word.confidence, 0.7), // Reduce confidence for proximity matches
            boundingBox: word.bounding_box
          };
        }
      }
    }

    return null;
  }

  private extractByPosition(fieldDef: FieldDefinition, words: WordResult[]): { value: string; confidence: number; boundingBox?: ExtractedField['bounding_box'] } | null {
    if (!fieldDef.position_hints) return null;

    // Simple position-based extraction (can be enhanced with ML)
    const hints = fieldDef.position_hints;
    
    // Filter words by position criteria
    const candidateWords = words.filter(word => {
      const { x, y, width, height } = word.bounding_box;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      if (hints.x_range && (centerX < hints.x_range[0] || centerX > hints.x_range[1])) return false;
      if (hints.y_range && (centerY < hints.y_range[0] || centerY > hints.y_range[1])) return false;
      
      return true;
    });

    // Find the most likely candidate
    for (const word of candidateWords) {
      if (this.isLikelyFieldValue(fieldDef.field_name, word.text)) {
        return {
          value: word.text,
          confidence: Math.min(word.confidence, 0.6), // Lower confidence for position-based
          boundingBox: word.bounding_box
        };
      }
    }

    return null;
  }

  private isLikelyFieldValue(fieldName: string, text: string): boolean {
    // Simple heuristics to determine if text could be a field value
    switch (fieldName) {
      case 'given_name':
      case 'family_name':
      case 'middle_name':
        return /^[A-Za-z\s\-']{2,30}$/.test(text) && !/^\d+$/.test(text);
      
      case 'date_of_birth':
      case 'birth_date':
      case 'dob':
        return /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|\d{2}\s\w{3}\s\d{4}/.test(text);
      
      case 'passport_number':
      case 'document_number':
        return /^[A-Z0-9]{6,12}$/.test(text);
      
      case 'nationality':
      case 'citizenship':
        return /^[A-Za-z\s]{3,20}$/.test(text) && !text.includes('SEX') && !text.includes('DOB');
      
      default:
        return text.length > 1 && text.length < 100;
    }
  }

  private normalizeFieldValue(fieldName: string, rawValue: string): any {
    switch (fieldName) {
      case 'date_of_birth':
      case 'birth_date':
      case 'dob':
        return this.normalizeDate(rawValue);
      
      case 'given_name':
      case 'family_name':
      case 'middle_name':
        return this.normalizeName(rawValue);
      
      case 'passport_number':
      case 'document_number':
        return rawValue.toUpperCase().replace(/\s/g, '');
      
      case 'sex':
      case 'gender':
        return this.normalizeGender(rawValue);
      
      default:
        return rawValue.trim();
    }
  }

  private normalizeDate(dateStr: string): string {
    // Try to parse various date formats and convert to YYYY-MM-DD
    const datePatterns = [
      /(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/,  // MM/DD/YYYY or DD/MM/YYYY
      /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/,  // YYYY/MM/DD
      /(\d{2})\s(\w{3})\s(\d{4})/             // DD MON YYYY
    ];

    for (const pattern of datePatterns) {
      const match = dateStr.match(pattern);
      if (match) {
        if (pattern === datePatterns[2]) { // Handle month name format
          const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                             'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
          const monthIndex = monthNames.indexOf(match[2].toUpperCase());
          if (monthIndex !== -1) {
            const day = match[1].padStart(2, '0');
            const month = (monthIndex + 1).toString().padStart(2, '0');
            return `${match[3]}-${month}-${day}`;
          }
        } else if (pattern === datePatterns[1]) { // YYYY/MM/DD
          return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else { // MM/DD/YYYY - assume US format
          return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
        }
      }
    }

    return dateStr; // Return as-is if no pattern matches
  }

  private normalizeName(name: string): string {
    return name
      .split(/\s+/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private normalizeGender(gender: string): string {
    const g = gender.toUpperCase();
    if (g === 'M' || g === 'MALE') return 'M';
    if (g === 'F' || g === 'FEMALE') return 'F';
    return 'X';
  }

  private getAllWords(ocrResult: OCRResult): WordResult[] {
    const allWords: WordResult[] = [];
    
    if (ocrResult.pages) {
      ocrResult.pages.forEach(page => {
        allWords.push(...page.words);
      });
    }

    return allWords;
  }

  private validateAndNormalizeFields(fields: ExtractedField[], documentType: string): ExtractedField[] {
    // Apply document-specific validation rules
    return fields.filter(field => {
      // Basic validation - reject very low confidence or empty values
      if (field.confidence < 0.3 || !field.normalized_value) {
        return false;
      }

      // Document-specific validation
      switch (documentType) {
        case 'passport':
          if (field.field_name === 'passport_number') {
            return /^[A-Z0-9]{6,12}$/.test(field.normalized_value);
          }
          break;
        
        case 'driver_license':
          if (field.field_name === 'license_number') {
            return field.normalized_value.length >= 4;
          }
          break;
      }

      return true;
    });
  }

  private initializePatterns(): Map<string, DocumentPattern> {
    const patterns = new Map<string, DocumentPattern>();

    // Passport patterns
    patterns.set('passport', {
      document_type: 'passport',
      fields: [
        {
          field_name: 'given_name',
          patterns: [
            { regex: 'Given Names?[:\\s]+([A-Z\\s]+)', capture_group: 1, confidence: 0.9 },
            { regex: 'First Name[:\\s]+([A-Z\\s]+)', capture_group: 1, confidence: 0.8 }
          ],
          keywords: ['Given Names', 'First Name', 'Given'],
          position_hints: { y_range: [200, 400] }
        },
        {
          field_name: 'family_name',
          patterns: [
            { regex: 'Surname[:\\s]+([A-Z\\s]+)', capture_group: 1, confidence: 0.9 },
            { regex: 'Last Name[:\\s]+([A-Z\\s]+)', capture_group: 1, confidence: 0.8 },
            { regex: '^([A-Z]{2,20}),\\s+[A-Z]', capture_group: 1, confidence: 0.7 }
          ],
          keywords: ['Surname', 'Last Name', 'Family Name'],
          position_hints: { y_range: [150, 350] }
        },
        {
          field_name: 'passport_number',
          patterns: [
            { regex: 'Passport No[:\\s]+([A-Z0-9]+)', capture_group: 1, confidence: 0.95 },
            { regex: 'Document No[:\\s]+([A-Z0-9]+)', capture_group: 1, confidence: 0.9 }
          ],
          keywords: ['Passport No', 'Document No', 'No'],
          position_hints: { y_range: [50, 200] }
        },
        {
          field_name: 'date_of_birth',
          patterns: [
            { regex: 'Date of Birth[:\\s]+(\\d{2}\\s\\w{3}\\s\\d{4})', capture_group: 1, confidence: 0.9 },
            { regex: 'DOB[:\\s]+(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{4})', capture_group: 1, confidence: 0.8 }
          ],
          keywords: ['Date of Birth', 'DOB', 'Born'],
          position_hints: { y_range: [300, 500] }
        },
        {
          field_name: 'nationality',
          patterns: [
            { regex: 'Nationality[:\\s]+([A-Z]+)', capture_group: 1, confidence: 0.9 }
          ],
          keywords: ['Nationality', 'Country'],
          position_hints: { y_range: [350, 450] }
        }
      ]
    });

    // Driver License patterns
    patterns.set('driver_license', {
      document_type: 'driver_license',
      fields: [
        {
          field_name: 'license_number',
          patterns: [
            { regex: 'DL NO[:\\s]+([A-Z0-9]+)', capture_group: 1, confidence: 0.9 },
            { regex: 'License[:\\s]+([A-Z0-9]+)', capture_group: 1, confidence: 0.8 }
          ],
          keywords: ['DL NO', 'License', 'ID'],
          position_hints: { y_range: [50, 150] }
        },
        {
          field_name: 'given_name',
          patterns: [
            { regex: '([A-Z]+),\\s+([A-Z]+)', capture_group: 2, confidence: 0.8 }
          ],
          keywords: ['Name', 'First'],
          position_hints: { y_range: [200, 400] }
        },
        {
          field_name: 'family_name',
          patterns: [
            { regex: '([A-Z]+),\\s+[A-Z]+', capture_group: 1, confidence: 0.8 }
          ],
          keywords: ['Name', 'Last'],
          position_hints: { y_range: [200, 400] }
        },
        {
          field_name: 'date_of_birth',
          patterns: [
            { regex: 'DOB[:\\s]+(\\d{2}/\\d{2}/\\d{4})', capture_group: 1, confidence: 0.9 }
          ],
          keywords: ['DOB', 'Birth'],
          position_hints: { y_range: [300, 500] }
        }
      ]
    });

    // Add more document patterns as needed...

    return patterns;
  }
}

interface DocumentPattern {
  document_type: string;
  fields: FieldDefinition[];
}

interface FieldDefinition {
  field_name: string;
  patterns: PatternDefinition[];
  keywords: string[];
  position_hints?: {
    x_range?: [number, number];
    y_range?: [number, number];
  };
}

interface PatternDefinition {
  regex: string;
  capture_group?: number;
  confidence?: number;
  flags?: string;
}