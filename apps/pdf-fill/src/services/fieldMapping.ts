export interface FieldMapping {
  pdfFieldName: string;
  canonicalPath: string;
  transformer: string;
  required: boolean;
  validation?: FieldValidation;
}

export interface FieldValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  allowedValues?: string[];
}

export class FieldMappingService {
  private mappings: Map<string, FieldMapping[]> = new Map();

  constructor() {
    this.initializeMappings();
  }

  async getMappings(formType: string): Promise<FieldMapping[]> {
    return this.mappings.get(formType) || [];
  }

  async addMapping(formType: string, mapping: FieldMapping): Promise<void> {
    const existingMappings = this.mappings.get(formType) || [];
    const updatedMappings = existingMappings.filter(m => m.pdfFieldName !== mapping.pdfFieldName);
    updatedMappings.push(mapping);
    this.mappings.set(formType, updatedMappings);
  }

  async removeMappingField(formType: string, pdfFieldName: string): Promise<void> {
    const existingMappings = this.mappings.get(formType) || [];
    const updatedMappings = existingMappings.filter(m => m.pdfFieldName !== pdfFieldName);
    this.mappings.set(formType, updatedMappings);
  }

  async updateMappings(formType: string, mappings: FieldMapping[]): Promise<void> {
    this.mappings.set(formType, mappings);
  }

  private initializeMappings(): void {
    // I-485 Form mappings
    this.mappings.set('i485', [
      // Personal Information
      {
        pdfFieldName: 'given_name',
        canonicalPath: 'applicant.name.given_name',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'family_name',
        canonicalPath: 'applicant.name.family_name',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'middle_name',
        canonicalPath: 'applicant.name.middle_name',
        transformer: 'default',
        required: false
      },
      {
        pdfFieldName: 'date_of_birth',
        canonicalPath: 'applicant.date_of_birth',
        transformer: 'date_us',
        required: true,
        validation: {
          pattern: '^\\d{2}/\\d{2}/\\d{4}$'
        }
      },
      {
        pdfFieldName: 'country_of_birth',
        canonicalPath: 'applicant.place_of_birth.country',
        transformer: 'country_code_to_name',
        required: true
      },
      
      // Address Information
      {
        pdfFieldName: 'current_address_street',
        canonicalPath: 'addresses.0.street_address',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'current_address_city',
        canonicalPath: 'addresses.0.city',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'current_address_state',
        canonicalPath: 'addresses.0.us_state',
        transformer: 'uppercase',
        required: true
      },
      {
        pdfFieldName: 'current_address_zipcode',
        canonicalPath: 'addresses.0.postal_code',
        transformer: 'default',
        required: true,
        validation: {
          pattern: '^\\d{5}(-\\d{4})?$'
        }
      },
      
      // Contact Information
      {
        pdfFieldName: 'email',
        canonicalPath: 'contact_info.email',
        transformer: 'lowercase',
        required: true,
        validation: {
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
        }
      },
      {
        pdfFieldName: 'phone',
        canonicalPath: 'contact_info.phone_primary',
        transformer: 'phone_us',
        required: true
      },
      
      // Application-specific fields
      {
        pdfFieldName: 'a_number',
        canonicalPath: 'applicant.a_number',
        transformer: 'default',
        required: false,
        validation: {
          pattern: '^A\\d{8,9}$'
        }
      },
      {
        pdfFieldName: 'current_immigration_status',
        canonicalPath: 'form_data.current_immigration_status',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'application_type',
        canonicalPath: 'form_data.application_type',
        transformer: 'default',
        required: true
      }
    ]);

    // I-130 Form mappings
    this.mappings.set('i130', [
      // Petitioner Information
      {
        pdfFieldName: 'given_name',
        canonicalPath: 'applicant.name.given_name',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'family_name',
        canonicalPath: 'applicant.name.family_name',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'middle_name',
        canonicalPath: 'applicant.name.middle_name',
        transformer: 'default',
        required: false
      },
      {
        pdfFieldName: 'date_of_birth',
        canonicalPath: 'applicant.date_of_birth',
        transformer: 'date_us',
        required: true
      },
      {
        pdfFieldName: 'country_of_birth',
        canonicalPath: 'applicant.place_of_birth.country',
        transformer: 'country_code_to_name',
        required: true
      },
      
      // Current Address
      {
        pdfFieldName: 'current_address_street',
        canonicalPath: 'addresses.0.street_address',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'current_address_city',
        canonicalPath: 'addresses.0.city',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'current_address_state',
        canonicalPath: 'addresses.0.us_state',
        transformer: 'uppercase',
        required: true
      },
      {
        pdfFieldName: 'current_address_zipcode',
        canonicalPath: 'addresses.0.postal_code',
        transformer: 'default',
        required: true
      },
      
      // Contact Information
      {
        pdfFieldName: 'email',
        canonicalPath: 'contact_info.email',
        transformer: 'lowercase',
        required: true
      },
      {
        pdfFieldName: 'phone',
        canonicalPath: 'contact_info.phone_primary',
        transformer: 'phone_us',
        required: true
      },
      
      // Beneficiary Information
      {
        pdfFieldName: 'beneficiary_given_name',
        canonicalPath: 'form_data.beneficiary.name.given_name',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'beneficiary_family_name',
        canonicalPath: 'form_data.beneficiary.name.family_name',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'relationship',
        canonicalPath: 'form_data.beneficiary.relationship_to_petitioner',
        transformer: 'default',
        required: true,
        validation: {
          allowedValues: ['spouse', 'child', 'parent', 'sibling']
        }
      },
      
      // Petitioner Status
      {
        pdfFieldName: 'petitioner_citizen',
        canonicalPath: 'form_data.petitioner.us_citizen',
        transformer: 'boolean_checkbox',
        required: true
      }
    ]);

    // I-131 Form mappings
    this.mappings.set('i131', [
      // Personal Information
      {
        pdfFieldName: 'given_name',
        canonicalPath: 'applicant.name.given_name',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'family_name',
        canonicalPath: 'applicant.name.family_name',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'middle_name',
        canonicalPath: 'applicant.name.middle_name',
        transformer: 'default',
        required: false
      },
      {
        pdfFieldName: 'date_of_birth',
        canonicalPath: 'applicant.date_of_birth',
        transformer: 'date_us',
        required: true
      },
      {
        pdfFieldName: 'country_of_birth',
        canonicalPath: 'applicant.place_of_birth.country',
        transformer: 'country_code_to_name',
        required: true
      },
      {
        pdfFieldName: 'current_address_street',
        canonicalPath: 'addresses.0.street_address',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'current_address_city',
        canonicalPath: 'addresses.0.city',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'current_address_state',
        canonicalPath: 'addresses.0.us_state',
        transformer: 'uppercase',
        required: true
      },
      {
        pdfFieldName: 'current_address_zipcode',
        canonicalPath: 'addresses.0.postal_code',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'email',
        canonicalPath: 'contact_info.email',
        transformer: 'lowercase',
        required: true
      },
      {
        pdfFieldName: 'phone',
        canonicalPath: 'contact_info.phone_primary',
        transformer: 'phone_us',
        required: true
      },
      
      // Document Type (these would be radio buttons or checkboxes)
      {
        pdfFieldName: 'document_type_reentry',
        canonicalPath: 'form_data.document_type',
        transformer: 'equals_reentry_permit',
        required: false
      },
      {
        pdfFieldName: 'document_type_refugee',
        canonicalPath: 'form_data.document_type',
        transformer: 'equals_refugee_travel',
        required: false
      },
      {
        pdfFieldName: 'document_type_advance_parole',
        canonicalPath: 'form_data.document_type',
        transformer: 'equals_advance_parole',
        required: false
      }
    ]);

    // G-28 Form mappings
    this.mappings.set('g28', [
      // Attorney Information
      {
        pdfFieldName: 'attorney_name',
        canonicalPath: 'form_data.attorney.name',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'attorney_bar_number',
        canonicalPath: 'form_data.attorney.bar_number',
        transformer: 'default',
        required: false
      },
      {
        pdfFieldName: 'attorney_address',
        canonicalPath: 'form_data.attorney.address.full_address',
        transformer: 'default',
        required: true
      },
      {
        pdfFieldName: 'attorney_phone',
        canonicalPath: 'form_data.attorney.phone',
        transformer: 'phone_us',
        required: true
      },
      
      // Client Information
      {
        pdfFieldName: 'client_name',
        canonicalPath: 'applicant.name.full_name',
        transformer: 'full_name',
        required: true
      },
      {
        pdfFieldName: 'client_case_number',
        canonicalPath: 'form_data.uscis_receipt_number',
        transformer: 'default',
        required: false
      }
    ]);
  }

  // Get all available transformers
  getAvailableTransformers(): string[] {
    return [
      'default',
      'uppercase',
      'lowercase',
      'date_us',
      'date_iso',
      'phone_us',
      'boolean_yesno',
      'boolean_checkbox',
      'country_code_to_name',
      'full_name',
      'equals_reentry_permit',
      'equals_refugee_travel',
      'equals_advance_parole'
    ];
  }

  // Get field mapping template for a form type
  getMappingTemplate(formType: string): Partial<FieldMapping> {
    return {
      pdfFieldName: '',
      canonicalPath: '',
      transformer: 'default',
      required: false
    };
  }

  // Validate field mapping
  validateMapping(mapping: FieldMapping): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!mapping.pdfFieldName || mapping.pdfFieldName.trim() === '') {
      errors.push('PDF field name is required');
    }

    if (!mapping.canonicalPath || mapping.canonicalPath.trim() === '') {
      errors.push('Canonical path is required');
    }

    if (!this.getAvailableTransformers().includes(mapping.transformer)) {
      errors.push(`Invalid transformer: ${mapping.transformer}`);
    }

    // Validate canonical path format
    if (mapping.canonicalPath && !this.isValidCanonicalPath(mapping.canonicalPath)) {
      errors.push('Invalid canonical path format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidCanonicalPath(path: string): boolean {
    // Basic validation for canonical path format
    // Should be dot-notation with optional array indices
    const pathRegex = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*|\[\d+\])*$/;
    return pathRegex.test(path);
  }

  // Import mappings from JSON
  async importMappings(formType: string, mappingsJson: any): Promise<void> {
    try {
      const mappings: FieldMapping[] = [];

      for (const item of mappingsJson) {
        const mapping: FieldMapping = {
          pdfFieldName: item.pdfFieldName,
          canonicalPath: item.canonicalPath,
          transformer: item.transformer || 'default',
          required: item.required || false,
          validation: item.validation
        };

        const validation = this.validateMapping(mapping);
        if (!validation.isValid) {
          throw new Error(`Invalid mapping for field ${mapping.pdfFieldName}: ${validation.errors.join(', ')}`);
        }

        mappings.push(mapping);
      }

      this.mappings.set(formType, mappings);

    } catch (error) {
      throw new Error(`Failed to import mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Export mappings to JSON
  async exportMappings(formType: string): Promise<any> {
    const mappings = this.mappings.get(formType) || [];
    return mappings.map(mapping => ({
      pdfFieldName: mapping.pdfFieldName,
      canonicalPath: mapping.canonicalPath,
      transformer: mapping.transformer,
      required: mapping.required,
      validation: mapping.validation
    }));
  }
}