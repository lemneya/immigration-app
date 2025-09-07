import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from 'pdf-lib';
import { v4 as uuidv4 } from 'uuid';
import { FormTemplateManager } from './templateManager';
import { FieldMappingService } from './fieldMapping';

export interface FillOptions {
  flatten?: boolean;
  includeMetadata?: boolean;
  validateFields?: boolean;
  preserveFormInteractivity?: boolean;
}

export interface FillResult {
  pdfBuffer: Buffer;
  metadata: FillMetadata;
  fieldMappings: FieldMapping[];
  validationResults: ValidationResult[];
}

export interface FillMetadata {
  fillId: string;
  formType: string;
  filledAt: string;
  fieldsTotal: number;
  fieldsFilled: number;
  fieldsSkipped: number;
  fieldsErrored: number;
  processingTime: number;
  version: string;
}

export interface FieldMapping {
  pdfFieldName: string;
  canonicalPath: string;
  value: any;
  transformed: boolean;
  fillStatus: 'filled' | 'skipped' | 'error';
  errorMessage?: string;
}

export interface ValidationResult {
  fieldName: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PreviewResult {
  fieldPreview: FieldPreview[];
  mappingInfo: MappingInfo;
  validationInfo: ValidationInfo;
}

export interface FieldPreview {
  pdfFieldName: string;
  canonicalPath: string;
  currentValue: any;
  proposedValue: any;
  fieldType: string;
  willFill: boolean;
  reason?: string;
}

export interface MappingInfo {
  totalMappings: number;
  activeMappings: number;
  unmappedFields: string[];
  mappingCoverage: number;
}

export interface ValidationInfo {
  totalFields: number;
  validFields: number;
  invalidFields: number;
  validationErrors: Array<{ field: string; errors: string[] }>;
}

export class PDFFormFiller {
  private templateManager: FormTemplateManager;
  private fieldMappingService: FieldMappingService;

  constructor(templateManager: FormTemplateManager, fieldMappingService: FieldMappingService) {
    this.templateManager = templateManager;
    this.fieldMappingService = fieldMappingService;
  }

  async fillForm(formType: string, canonicalData: any, options: FillOptions = {}): Promise<FillResult> {
    const startTime = Date.now();
    const fillId = uuidv4();

    try {
      // Get the PDF template
      const templateBuffer = await this.templateManager.getTemplateBuffer(formType);
      if (!templateBuffer) {
        throw new Error(`Template not found for form type: ${formType}`);
      }

      // Load PDF document
      const pdfDoc = await PDFDocument.load(templateBuffer);
      const form = pdfDoc.getForm();

      // Get field mappings for this form type
      const mappings = await this.fieldMappingService.getMappings(formType);

      // Fill the form
      const { fieldMappings, validationResults } = await this.fillPDFForm(
        form, 
        mappings, 
        canonicalData, 
        options
      );

      // Apply post-processing options
      if (options.flatten !== false) {
        form.flatten();
      }

      // Add metadata if requested
      if (options.includeMetadata !== false) {
        await this.addMetadata(pdfDoc, {
          fillId,
          formType,
          filledAt: new Date().toISOString(),
          version: '1.0'
        });
      }

      // Generate final PDF buffer
      const pdfBuffer = Buffer.from(await pdfDoc.save());
      const processingTime = Date.now() - startTime;

      // Create metadata
      const metadata: FillMetadata = {
        fillId,
        formType,
        filledAt: new Date().toISOString(),
        fieldsTotal: fieldMappings.length,
        fieldsFilled: fieldMappings.filter(f => f.fillStatus === 'filled').length,
        fieldsSkipped: fieldMappings.filter(f => f.fillStatus === 'skipped').length,
        fieldsErrored: fieldMappings.filter(f => f.fillStatus === 'error').length,
        processingTime,
        version: '1.0'
      };

      return {
        pdfBuffer,
        metadata,
        fieldMappings,
        validationResults
      };

    } catch (error) {
      throw new Error(`Failed to fill form ${formType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fillCustomForm(
    templateBuffer: Buffer, 
    canonicalData: any, 
    customMappings: { [pdfField: string]: string } = {},
    options: FillOptions = {}
  ): Promise<FillResult> {
    const startTime = Date.now();
    const fillId = uuidv4();

    try {
      // Load PDF document
      const pdfDoc = await PDFDocument.load(templateBuffer);
      const form = pdfDoc.getForm();

      // Convert custom mappings to standard format
      const mappings = Object.entries(customMappings).map(([pdfField, canonicalPath]) => ({
        pdfFieldName: pdfField,
        canonicalPath,
        transformer: 'default',
        required: false
      }));

      // Fill the form
      const { fieldMappings, validationResults } = await this.fillPDFForm(
        form, 
        mappings, 
        canonicalData, 
        options
      );

      // Apply post-processing options
      if (options.flatten !== false) {
        form.flatten();
      }

      // Add metadata if requested
      if (options.includeMetadata !== false) {
        await this.addMetadata(pdfDoc, {
          fillId,
          formType: 'custom',
          filledAt: new Date().toISOString(),
          version: '1.0'
        });
      }

      const pdfBuffer = Buffer.from(await pdfDoc.save());
      const processingTime = Date.now() - startTime;

      const metadata: FillMetadata = {
        fillId,
        formType: 'custom',
        filledAt: new Date().toISOString(),
        fieldsTotal: fieldMappings.length,
        fieldsFilled: fieldMappings.filter(f => f.fillStatus === 'filled').length,
        fieldsSkipped: fieldMappings.filter(f => f.fillStatus === 'skipped').length,
        fieldsErrored: fieldMappings.filter(f => f.fillStatus === 'error').length,
        processingTime,
        version: '1.0'
      };

      return {
        pdfBuffer,
        metadata,
        fieldMappings,
        validationResults
      };

    } catch (error) {
      throw new Error(`Failed to fill custom form: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async previewFormFields(formType: string, canonicalData: any): Promise<PreviewResult> {
    try {
      // Get the PDF template
      const templateBuffer = await this.templateManager.getTemplateBuffer(formType);
      if (!templateBuffer) {
        throw new Error(`Template not found for form type: ${formType}`);
      }

      // Load PDF document
      const pdfDoc = await PDFDocument.load(templateBuffer);
      const form = pdfDoc.getForm();

      // Get field mappings
      const mappings = await this.fieldMappingService.getMappings(formType);

      // Generate preview
      const fieldPreview: FieldPreview[] = [];
      const unmappedFields: string[] = [];
      let activeMappings = 0;

      const formFields = form.getFields();

      for (const field of formFields) {
        const fieldName = field.getName();
        const mapping = mappings.find(m => m.pdfFieldName === fieldName);

        if (mapping) {
          const currentValue = this.getFieldValue(field);
          const canonicalValue = this.getValueFromCanonicalData(canonicalData, mapping.canonicalPath);
          const proposedValue = await this.transformValue(canonicalValue, mapping.transformer);

          fieldPreview.push({
            pdfFieldName: fieldName,
            canonicalPath: mapping.canonicalPath,
            currentValue,
            proposedValue,
            fieldType: this.getFieldType(field),
            willFill: canonicalValue !== undefined && canonicalValue !== null,
            reason: canonicalValue === undefined ? 'No canonical data' : undefined
          });

          if (canonicalValue !== undefined) {
            activeMappings++;
          }
        } else {
          unmappedFields.push(fieldName);
        }
      }

      const mappingInfo: MappingInfo = {
        totalMappings: mappings.length,
        activeMappings,
        unmappedFields,
        mappingCoverage: mappings.length > 0 ? (activeMappings / mappings.length) * 100 : 0
      };

      // Basic validation info
      const validationInfo: ValidationInfo = {
        totalFields: fieldPreview.length,
        validFields: fieldPreview.filter(f => f.willFill).length,
        invalidFields: fieldPreview.filter(f => !f.willFill).length,
        validationErrors: []
      };

      return {
        fieldPreview,
        mappingInfo,
        validationInfo
      };

    } catch (error) {
      throw new Error(`Failed to preview form: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFormFields(formType: string): Promise<Array<{ name: string; type: string; options?: string[] }>> {
    try {
      const templateBuffer = await this.templateManager.getTemplateBuffer(formType);
      if (!templateBuffer) {
        throw new Error(`Template not found for form type: ${formType}`);
      }

      const pdfDoc = await PDFDocument.load(templateBuffer);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      return fields.map(field => {
        const fieldInfo: any = {
          name: field.getName(),
          type: this.getFieldType(field)
        };

        // Add options for dropdown/radio fields
        if (field instanceof PDFDropdown) {
          fieldInfo.options = field.getOptions();
        } else if (field instanceof PDFRadioGroup) {
          fieldInfo.options = field.getOptions();
        }

        return fieldInfo;
      });

    } catch (error) {
      throw new Error(`Failed to get form fields: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fillPDFForm(
    form: PDFForm, 
    mappings: any[], 
    canonicalData: any, 
    options: FillOptions
  ): Promise<{ fieldMappings: FieldMapping[]; validationResults: ValidationResult[] }> {
    const fieldMappings: FieldMapping[] = [];
    const validationResults: ValidationResult[] = [];

    for (const mapping of mappings) {
      try {
        const field = form.getField(mapping.pdfFieldName);
        const canonicalValue = this.getValueFromCanonicalData(canonicalData, mapping.canonicalPath);

        if (canonicalValue === undefined || canonicalValue === null) {
          fieldMappings.push({
            pdfFieldName: mapping.pdfFieldName,
            canonicalPath: mapping.canonicalPath,
            value: canonicalValue,
            transformed: false,
            fillStatus: 'skipped',
            errorMessage: 'No canonical data available'
          });
          continue;
        }

        // Transform the value if needed
        const transformedValue = await this.transformValue(canonicalValue, mapping.transformer);

        // Validate if requested
        if (options.validateFields) {
          const validation = this.validateFieldValue(field, transformedValue);
          validationResults.push({
            fieldName: mapping.pdfFieldName,
            isValid: validation.isValid,
            errors: validation.errors,
            warnings: validation.warnings || []
          });

          if (!validation.isValid && mapping.required) {
            fieldMappings.push({
              pdfFieldName: mapping.pdfFieldName,
              canonicalPath: mapping.canonicalPath,
              value: transformedValue,
              transformed: true,
              fillStatus: 'error',
              errorMessage: `Validation failed: ${validation.errors.join(', ')}`
            });
            continue;
          }
        }

        // Fill the field
        await this.fillPDFField(field, transformedValue);

        fieldMappings.push({
          pdfFieldName: mapping.pdfFieldName,
          canonicalPath: mapping.canonicalPath,
          value: transformedValue,
          transformed: canonicalValue !== transformedValue,
          fillStatus: 'filled'
        });

      } catch (error) {
        fieldMappings.push({
          pdfFieldName: mapping.pdfFieldName,
          canonicalPath: mapping.canonicalPath,
          value: undefined,
          transformed: false,
          fillStatus: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { fieldMappings, validationResults };
  }

  private async fillPDFField(field: any, value: any): Promise<void> {
    if (field instanceof PDFTextField) {
      field.setText(String(value || ''));
    } else if (field instanceof PDFCheckBox) {
      if (typeof value === 'boolean') {
        if (value) {
          field.check();
        } else {
          field.uncheck();
        }
      } else {
        // Handle string values for checkboxes
        const stringValue = String(value || '').toLowerCase();
        if (['yes', 'true', '1', 'on', 'checked'].includes(stringValue)) {
          field.check();
        } else {
          field.uncheck();
        }
      }
    } else if (field instanceof PDFRadioGroup) {
      const stringValue = String(value || '');
      try {
        field.select(stringValue);
      } catch (error) {
        // If exact value doesn't match, try to find a close match
        const options = field.getOptions();
        const closeMatch = options.find(option => 
          option.toLowerCase().includes(stringValue.toLowerCase()) ||
          stringValue.toLowerCase().includes(option.toLowerCase())
        );
        if (closeMatch) {
          field.select(closeMatch);
        }
      }
    } else if (field instanceof PDFDropdown) {
      const stringValue = String(value || '');
      try {
        field.select(stringValue);
      } catch (error) {
        // If exact value doesn't match, try to find a close match
        const options = field.getOptions();
        const closeMatch = options.find(option => 
          option.toLowerCase().includes(stringValue.toLowerCase()) ||
          stringValue.toLowerCase().includes(option.toLowerCase())
        );
        if (closeMatch) {
          field.select(closeMatch);
        }
      }
    }
  }

  private getValueFromCanonicalData(canonicalData: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (key.includes('[') && key.includes(']')) {
        // Handle array access like 'citizenship[0]'
        const [arrayKey, indexStr] = key.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        return current?.[arrayKey]?.[index];
      }
      return current?.[key];
    }, canonicalData);
  }

  private async transformValue(value: any, transformer: string): Promise<any> {
    switch (transformer) {
      case 'uppercase':
        return String(value || '').toUpperCase();
      
      case 'lowercase':
        return String(value || '').toLowerCase();
      
      case 'date_us':
        return this.formatDateUS(value);
      
      case 'date_iso':
        return this.formatDateISO(value);
      
      case 'phone_us':
        return this.formatPhoneUS(value);
      
      case 'boolean_yesno':
        return value ? 'Yes' : 'No';
      
      case 'boolean_checkbox':
        return Boolean(value);
      
      case 'country_code_to_name':
        return this.countryCodeToName(value);
      
      case 'default':
      default:
        return value;
    }
  }

  private formatDateUS(dateValue: any): string {
    if (!dateValue) return '';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return String(dateValue);
      
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    } catch {
      return String(dateValue);
    }
  }

  private formatDateISO(dateValue: any): string {
    if (!dateValue) return '';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return String(dateValue);
      
      return date.toISOString().split('T')[0];
    } catch {
      return String(dateValue);
    }
  }

  private formatPhoneUS(phoneValue: any): string {
    if (!phoneValue) return '';
    
    const digits = String(phoneValue).replace(/\D/g, '');
    
    if (digits.length === 10) {
      return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      return `(${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7)}`;
    }
    
    return String(phoneValue);
  }

  private countryCodeToName(countryCode: any): string {
    const countryNames: { [code: string]: string } = {
      'US': 'United States',
      'CA': 'Canada',
      'MX': 'Mexico',
      'GB': 'United Kingdom',
      'FR': 'France',
      'DE': 'Germany',
      'ES': 'Spain',
      'IT': 'Italy',
      'JP': 'Japan',
      'CN': 'China',
      'IN': 'India',
      'BR': 'Brazil'
      // Add more as needed
    };
    
    return countryNames[String(countryCode || '').toUpperCase()] || String(countryCode || '');
  }

  private getFieldValue(field: any): any {
    if (field instanceof PDFTextField) {
      return field.getText();
    } else if (field instanceof PDFCheckBox) {
      return field.isChecked();
    } else if (field instanceof PDFRadioGroup) {
      return field.getSelected();
    } else if (field instanceof PDFDropdown) {
      return field.getSelected();
    }
    return null;
  }

  private getFieldType(field: any): string {
    if (field instanceof PDFTextField) return 'text';
    if (field instanceof PDFCheckBox) return 'checkbox';
    if (field instanceof PDFRadioGroup) return 'radio';
    if (field instanceof PDFDropdown) return 'dropdown';
    return 'unknown';
  }

  private validateFieldValue(field: any, value: any): { isValid: boolean; errors: string[]; warnings?: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (field instanceof PDFTextField) {
      const text = String(value || '');
      if (text.length > 1000) {
        errors.push('Text too long (max 1000 characters)');
      }
    } else if (field instanceof PDFDropdown || field instanceof PDFRadioGroup) {
      const stringValue = String(value || '');
      const options = field.getOptions();
      if (stringValue && !options.includes(stringValue)) {
        warnings.push(`Value "${stringValue}" not in available options: ${options.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private async addMetadata(pdfDoc: PDFDocument, metadata: any): Promise<void> {
    try {
      pdfDoc.setTitle(`USCIS Form ${metadata.formType} - Filled ${metadata.filledAt}`);
      pdfDoc.setSubject(`Filled by Immigration Suite PDF Fill Service`);
      pdfDoc.setCreator('Immigration Suite PDF Fill Service v' + metadata.version);
      pdfDoc.setProducer('Immigration Suite');
      pdfDoc.setCreationDate(new Date());
      pdfDoc.setModificationDate(new Date());
      
      // Add custom metadata
      // Note: pdf-lib doesn't support custom metadata directly, 
      // but we could add it as annotations or hidden fields if needed
    } catch (error) {
      // Metadata addition is optional, don't fail the whole operation
      console.warn('Failed to add PDF metadata:', error);
    }
  }
}