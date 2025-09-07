import { ExtractedField, ExtractionResult } from '../extractors/fieldExtractor';

export interface ProcessingOptions {
  documentType: string;
  language: string;
  confidence_threshold: number;
  user_id?: string;
  existing_canonical?: any;
}

export interface ProcessingResult {
  canonical_data: any;
  validation_errors: string[];
  processing_notes: string[];
  field_mappings: FieldMapping[];
  confidence_scores: { [field: string]: number };
}

export interface FieldMapping {
  ocr_field: string;
  canonical_path: string;
  mapping_confidence: number;
  transformation_applied?: string;
}

export class DocumentProcessor {
  private fieldMappings: Map<string, string>;
  private validationRules: Map<string, ValidationRule>;

  constructor() {
    this.fieldMappings = this.initializeFieldMappings();
    this.validationRules = this.initializeValidationRules();
  }

  async processFields(extractionResult: ExtractionResult, options: ProcessingOptions): Promise<ProcessingResult> {
    const processingNotes: string[] = [...extractionResult.processing_notes];
    const validationErrors: string[] = [];
    const fieldMappings: FieldMapping[] = [];
    const confidenceScores: { [field: string]: number } = {};

    // Convert extracted fields to OCR results format
    const ocrResults = this.convertToOCRResults(extractionResult.fields);
    
    let canonicalData: any;

    try {
      // Basic mapping to canonical format
      canonicalData = {
        ...options.existing_canonical,
        updated_at: new Date().toISOString(),
        field_provenance: ocrResults.map(result => ({
          field_path: result.field_name,
          source: 'ocr_extracted',
          confidence: result.confidence,
          timestamp: new Date().toISOString()
        }))
      };
      
      processingNotes.push(`Successfully mapped ${ocrResults.length} OCR results to canonical format`);
    } catch (error) {
      validationErrors.push(`Failed to map OCR results to canonical format: ${error}`);
      canonicalData = options.existing_canonical || {};
    }

    // Process each extracted field
    for (const field of extractionResult.fields) {
      const canonicalPath = this.getCanonicalPath(field.field_name);
      
      if (canonicalPath) {
        // Validate the field value
        const validationResult = this.validateField(field, options.documentType);
        if (!validationResult.isValid) {
          validationErrors.push(...validationResult.errors);
        }

        // Apply document-specific processing
        const processedValue = await this.applyDocumentProcessing(field, options);

        fieldMappings.push({
          ocr_field: field.field_name,
          canonical_path: canonicalPath,
          mapping_confidence: field.confidence,
          transformation_applied: processedValue.transformation
        });

        confidenceScores[field.field_name] = field.confidence;
      } else {
        processingNotes.push(`No canonical mapping found for field: ${field.field_name}`);
      }
    }

    // Apply document-specific post-processing
    const postProcessedData = this.applyPostProcessing(canonicalData, extractionResult.document_type);
    
    // Calculate overall processing confidence
    this.calculateProcessingMetrics(postProcessedData, fieldMappings, processingNotes);

    return {
      canonical_data: postProcessedData,
      validation_errors: validationErrors,
      processing_notes: processingNotes,
      field_mappings: fieldMappings,
      confidence_scores: confidenceScores
    };
  }

  private convertToOCRResults(fields: ExtractedField[]): any[] {
    return fields.map(field => ({
      field_name: field.field_name,
      raw_text: field.raw_text,
      normalized_value: field.normalized_value,
      confidence: field.confidence,
      bounding_box: field.bounding_box ? {
        x: field.bounding_box.x,
        y: field.bounding_box.y,
        width: field.bounding_box.width,
        height: field.bounding_box.height,
        page: field.bounding_box.page
      } : undefined
    }));
  }

  private validateField(field: ExtractedField, documentType: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const rule = this.validationRules.get(field.field_name);

    if (!rule) {
      return { isValid: true, errors: [] };
    }

    // Check confidence threshold
    if (field.confidence < rule.min_confidence) {
      errors.push(`Field ${field.field_name} confidence (${field.confidence}) below minimum (${rule.min_confidence})`);
    }

    // Apply regex validation if specified
    if (rule.pattern) {
      if (!new RegExp(rule.pattern).test(field.normalized_value)) {
        errors.push(`Field ${field.field_name} does not match expected pattern`);
      }
    }

    // Apply custom validation function
    if (rule.validator) {
      const customValidation = rule.validator(field.normalized_value, documentType);
      if (!customValidation.isValid) {
        errors.push(...customValidation.errors);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  private async applyDocumentProcessing(field: ExtractedField, options: ProcessingOptions): Promise<{ value: any; transformation?: string }> {
    let processedValue = field.normalized_value;
    let transformation: string | undefined;

    // Apply document-specific processing rules
    switch (options.documentType) {
      case 'passport':
        processedValue = await this.processPassportField(field, processedValue);
        transformation = 'passport_processing';
        break;
        
      case 'driver_license':
        processedValue = await this.processDriverLicenseField(field, processedValue);
        transformation = 'driver_license_processing';
        break;
        
      case 'birth_certificate':
        processedValue = await this.processBirthCertificateField(field, processedValue);
        transformation = 'birth_certificate_processing';
        break;
    }

    // Apply language-specific processing
    if (options.language !== 'en') {
      processedValue = await this.applyLanguageProcessing(field, processedValue, options.language);
      transformation = `${transformation || 'base'}_${options.language}`;
    }

    return { value: processedValue, transformation };
  }

  private async processPassportField(field: ExtractedField, value: any): Promise<any> {
    switch (field.field_name) {
      case 'nationality':
        return this.normalizeCountryName(value);
        
      case 'passport_number':
        return typeof value === 'string' ? value.replace(/\s/g, '').toUpperCase() : value;
        
      case 'place_of_birth':
        return this.parseLocationString(value);
        
      default:
        return value;
    }
  }

  private async processDriverLicenseField(field: ExtractedField, value: any): Promise<any> {
    switch (field.field_name) {
      case 'license_number':
        return typeof value === 'string' ? value.replace(/[\s\-]/g, '').toUpperCase() : value;
        
      case 'address':
        return this.parseAddressString(value);
        
      default:
        return value;
    }
  }

  private async processBirthCertificateField(field: ExtractedField, value: any): Promise<any> {
    switch (field.field_name) {
      case 'certificate_number':
        return typeof value === 'string' ? value.replace(/\s/g, '').toUpperCase() : value;
        
      default:
        return value;
    }
  }

  private async applyLanguageProcessing(field: ExtractedField, value: any, language: string): Promise<any> {
    // Language-specific processing
    switch (language) {
      case 'ar':
        return this.processArabicText(value);
      case 'es':
        return this.processSpanishText(value);
      case 'fr':
        return this.processFrenchText(value);
      default:
        return value;
    }
  }

  private applyPostProcessing(canonicalData: any, documentType: string): any {
    const processed = { ...canonicalData };

    // Document-specific post-processing
    switch (documentType) {
      case 'passport':
        if (processed.form_data && typeof processed.form_data === 'object') {
          (processed.form_data as any).document_source = 'passport_ocr';
        }
        break;
    }

    processed.updated_at = new Date().toISOString();
    
    return processed;
  }

  private calculateProcessingMetrics(canonicalData: any, fieldMappings: FieldMapping[], notes: string[]): void {
    const totalFields = fieldMappings.length;
    const highConfidenceFields = fieldMappings.filter(m => m.mapping_confidence > 0.8).length;
    
    notes.push(`Processing complete: ${totalFields} fields processed, ${highConfidenceFields} high confidence`);
    
    if (canonicalData.completion_percentage === undefined && totalFields > 0) {
      canonicalData.completion_percentage = Math.min(95, Math.round((totalFields / 15) * 100));
    }
  }

  private getCanonicalPath(fieldName: string): string | null {
    return this.fieldMappings.get(fieldName) || null;
  }

  private normalizeCountryName(countryName: string): string {
    const countryMappings: { [key: string]: string } = {
      'USA': 'US',
      'UNITED STATES': 'US',
      'UNITED STATES OF AMERICA': 'US',
      'UK': 'GB',
      'UNITED KINGDOM': 'GB',
      'GREAT BRITAIN': 'GB'
    };

    const normalized = countryName.toUpperCase();
    return countryMappings[normalized] || countryName;
  }

  private parseLocationString(location: string): { city?: string; country?: string } {
    const parts = location.split(',').map(p => p.trim());
    
    if (parts.length >= 2) {
      return {
        city: parts[0],
        country: this.normalizeCountryName(parts[parts.length - 1])
      };
    }
    
    return { city: location };
  }

  private parseAddressString(address: string): any {
    const lines = address.split('\n').map(line => line.trim());
    
    return {
      street_address: lines[0] || '',
      street_address_2: lines[1] || undefined,
    };
  }

  private processArabicText(text: any): any {
    if (typeof text !== 'string') return text;
    return text.trim();
  }

  private processSpanishText(text: any): any {
    if (typeof text !== 'string') return text;
    return text.trim();
  }

  private processFrenchText(text: any): any {
    if (typeof text !== 'string') return text;
    return text.trim();
  }

  private initializeFieldMappings(): Map<string, string> {
    const mappings = new Map<string, string>();
    
    mappings.set('given_name', 'applicant.name.given_name');
    mappings.set('first_name', 'applicant.name.given_name');
    mappings.set('family_name', 'applicant.name.family_name');
    mappings.set('last_name', 'applicant.name.family_name');
    mappings.set('surname', 'applicant.name.family_name');
    mappings.set('middle_name', 'applicant.name.middle_name');
    mappings.set('date_of_birth', 'applicant.date_of_birth');
    mappings.set('birth_date', 'applicant.date_of_birth');
    mappings.set('dob', 'applicant.date_of_birth');
    mappings.set('place_of_birth', 'applicant.place_of_birth.city');
    mappings.set('country_of_birth', 'applicant.place_of_birth.country');
    mappings.set('nationality', 'applicant.citizenship[0]');
    mappings.set('citizenship', 'applicant.citizenship[0]');
    
    mappings.set('passport_number', 'documents_uploaded[0].document_number');
    mappings.set('document_number', 'documents_uploaded[0].document_number');
    mappings.set('license_number', 'documents_uploaded[0].document_number');
    mappings.set('certificate_number', 'documents_uploaded[0].document_number');
    
    return mappings;
  }

  private initializeValidationRules(): Map<string, ValidationRule> {
    const rules = new Map<string, ValidationRule>();
    
    rules.set('given_name', {
      min_confidence: 0.6,
      pattern: '^[A-Za-z\\s\\-\']{2,50}$',
      validator: (value: string) => ({
        isValid: value.length >= 2 && value.length <= 50,
        errors: value.length < 2 ? ['Given name too short'] : value.length > 50 ? ['Given name too long'] : []
      })
    });
    
    rules.set('family_name', {
      min_confidence: 0.6,
      pattern: '^[A-Za-z\\s\\-\']{2,50}$',
      validator: (value: string) => ({
        isValid: value.length >= 2 && value.length <= 50,
        errors: value.length < 2 ? ['Family name too short'] : value.length > 50 ? ['Family name too long'] : []
      })
    });
    
    rules.set('date_of_birth', {
      min_confidence: 0.7,
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      validator: (value: string) => {
        const date = new Date(value);
        const isValid = !isNaN(date.getTime()) && date < new Date();
        return {
          isValid,
          errors: isValid ? [] : ['Invalid date of birth']
        };
      }
    });
    
    rules.set('passport_number', {
      min_confidence: 0.8,
      pattern: '^[A-Z0-9]{6,12}$',
      validator: (value: string) => ({
        isValid: value.length >= 6 && value.length <= 12,
        errors: value.length < 6 ? ['Passport number too short'] : value.length > 12 ? ['Passport number too long'] : []
      })
    });
    
    return rules;
  }
}

interface ValidationRule {
  min_confidence: number;
  pattern?: string;
  validator?: (value: any, documentType?: string) => { isValid: boolean; errors: string[] };
}