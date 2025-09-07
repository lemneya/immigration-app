export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fieldResults: FieldValidationResult[];
}

export interface FieldValidationResult {
  fieldPath: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  value: any;
}

export class ValidationService {
  
  async validateCanonicalData(canonicalData: any, formType: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldResults: FieldValidationResult[] = [];

    // Basic structure validation
    if (!canonicalData || typeof canonicalData !== 'object') {
      errors.push('Canonical data must be a valid object');
      return {
        isValid: false,
        errors,
        warnings,
        fieldResults
      };
    }

    // Form-specific validation
    switch (formType) {
      case 'i485':
        await this.validateI485Data(canonicalData, fieldResults, errors, warnings);
        break;
      
      case 'i130':
        await this.validateI130Data(canonicalData, fieldResults, errors, warnings);
        break;
      
      case 'i131':
        await this.validateI131Data(canonicalData, fieldResults, errors, warnings);
        break;
      
      case 'g28':
        await this.validateG28Data(canonicalData, fieldResults, errors, warnings);
        break;
      
      default:
        await this.validateGenericData(canonicalData, fieldResults, errors, warnings);
    }

    return {
      isValid: errors.length === 0 && fieldResults.every(fr => fr.isValid),
      errors,
      warnings,
      fieldResults
    };
  }

  private async validateI485Data(
    data: any, 
    fieldResults: FieldValidationResult[], 
    errors: string[], 
    warnings: string[]
  ): Promise<void> {
    // Validate applicant information
    this.validatePersonalInfo(data.applicant, 'applicant', fieldResults, errors, warnings);
    
    // Validate addresses
    if (!data.addresses || !Array.isArray(data.addresses) || data.addresses.length === 0) {
      errors.push('At least one address is required');
    } else {
      this.validateAddress(data.addresses[0], 'addresses[0]', fieldResults, errors, warnings);
    }
    
    // Validate contact info
    this.validateContactInfo(data.contact_info, 'contact_info', fieldResults, errors, warnings);
    
    // Validate form-specific data
    if (data.form_data) {
      this.validateI485FormData(data.form_data, 'form_data', fieldResults, errors, warnings);
    }
  }

  private async validateI130Data(
    data: any, 
    fieldResults: FieldValidationResult[], 
    errors: string[], 
    warnings: string[]
  ): Promise<void> {
    // Validate petitioner (applicant) information
    this.validatePersonalInfo(data.applicant, 'applicant', fieldResults, errors, warnings);
    
    // Validate addresses
    if (!data.addresses || !Array.isArray(data.addresses) || data.addresses.length === 0) {
      errors.push('At least one address is required');
    } else {
      this.validateAddress(data.addresses[0], 'addresses[0]', fieldResults, errors, warnings);
    }
    
    // Validate contact info
    this.validateContactInfo(data.contact_info, 'contact_info', fieldResults, errors, warnings);
    
    // Validate form-specific data
    if (data.form_data) {
      this.validateI130FormData(data.form_data, 'form_data', fieldResults, errors, warnings);
    }
  }

  private async validateI131Data(
    data: any, 
    fieldResults: FieldValidationResult[], 
    errors: string[], 
    warnings: string[]
  ): Promise<void> {
    // Similar validation structure as I-485
    this.validatePersonalInfo(data.applicant, 'applicant', fieldResults, errors, warnings);
    
    if (!data.addresses || !Array.isArray(data.addresses) || data.addresses.length === 0) {
      errors.push('At least one address is required');
    } else {
      this.validateAddress(data.addresses[0], 'addresses[0]', fieldResults, errors, warnings);
    }
    
    this.validateContactInfo(data.contact_info, 'contact_info', fieldResults, errors, warnings);
    
    if (data.form_data) {
      this.validateI131FormData(data.form_data, 'form_data', fieldResults, errors, warnings);
    }
  }

  private async validateG28Data(
    data: any, 
    fieldResults: FieldValidationResult[], 
    errors: string[], 
    warnings: string[]
  ): Promise<void> {
    // Validate client information
    this.validatePersonalInfo(data.applicant, 'applicant', fieldResults, errors, warnings);
    
    // Validate attorney information
    if (data.form_data && data.form_data.attorney) {
      this.validateAttorneyInfo(data.form_data.attorney, 'form_data.attorney', fieldResults, errors, warnings);
    } else {
      errors.push('Attorney information is required for G-28');
    }
  }

  private async validateGenericData(
    data: any, 
    fieldResults: FieldValidationResult[], 
    errors: string[], 
    warnings: string[]
  ): Promise<void> {
    // Basic validation for unknown form types
    if (data.applicant) {
      this.validatePersonalInfo(data.applicant, 'applicant', fieldResults, errors, warnings);
    }
    
    if (data.addresses && Array.isArray(data.addresses) && data.addresses.length > 0) {
      this.validateAddress(data.addresses[0], 'addresses[0]', fieldResults, errors, warnings);
    }
    
    if (data.contact_info) {
      this.validateContactInfo(data.contact_info, 'contact_info', fieldResults, errors, warnings);
    }
  }

  private validatePersonalInfo(
    info: any, 
    path: string, 
    fieldResults: FieldValidationResult[], 
    errors: string[], 
    warnings: string[]
  ): void {
    if (!info || typeof info !== 'object') {
      errors.push(`${path} is required and must be an object`);
      return;
    }

    // Validate name
    if (!info.name || typeof info.name !== 'object') {
      errors.push(`${path}.name is required`);
    } else {
      this.validateField(
        info.name.given_name,
        `${path}.name.given_name`,
        'string',
        true,
        { minLength: 1, maxLength: 50 },
        fieldResults,
        errors,
        warnings
      );

      this.validateField(
        info.name.family_name,
        `${path}.name.family_name`,
        'string',
        true,
        { minLength: 1, maxLength: 50 },
        fieldResults,
        errors,
        warnings
      );

      if (info.name.middle_name) {
        this.validateField(
          info.name.middle_name,
          `${path}.name.middle_name`,
          'string',
          false,
          { maxLength: 50 },
          fieldResults,
          errors,
          warnings
        );
      }
    }

    // Validate date of birth
    this.validateField(
      info.date_of_birth,
      `${path}.date_of_birth`,
      'date',
      true,
      { pattern: /^\d{4}-\d{2}-\d{2}$/ },
      fieldResults,
      errors,
      warnings
    );

    // Validate place of birth
    if (info.place_of_birth) {
      this.validateField(
        info.place_of_birth.country,
        `${path}.place_of_birth.country`,
        'string',
        true,
        { pattern: /^[A-Z]{2}$/ },
        fieldResults,
        errors,
        warnings
      );
    }

    // Validate citizenship
    if (info.citizenship && Array.isArray(info.citizenship)) {
      if (info.citizenship.length === 0) {
        errors.push(`${path}.citizenship must contain at least one country`);
      } else {
        info.citizenship.forEach((country: string, index: number) => {
          this.validateField(
            country,
            `${path}.citizenship[${index}]`,
            'string',
            true,
            { pattern: /^[A-Z]{2}$/ },
            fieldResults,
            errors,
            warnings
          );
        });
      }
    } else {
      errors.push(`${path}.citizenship is required and must be an array`);
    }

    // Validate A-Number if present
    if (info.a_number) {
      this.validateField(
        info.a_number,
        `${path}.a_number`,
        'string',
        false,
        { pattern: /^A\d{8,9}$/ },
        fieldResults,
        errors,
        warnings
      );
    }
  }

  private validateAddress(
    address: any, 
    path: string, 
    fieldResults: FieldValidationResult[], 
    errors: string[], 
    warnings: string[]
  ): void {
    if (!address || typeof address !== 'object') {
      errors.push(`${path} is required and must be an object`);
      return;
    }

    this.validateField(
      address.street_address,
      `${path}.street_address`,
      'string',
      true,
      { minLength: 1, maxLength: 100 },
      fieldResults,
      errors,
      warnings
    );

    this.validateField(
      address.city,
      `${path}.city`,
      'string',
      true,
      { minLength: 1, maxLength: 50 },
      fieldResults,
      errors,
      warnings
    );

    this.validateField(
      address.postal_code,
      `${path}.postal_code`,
      'string',
      true,
      { minLength: 1, maxLength: 20 },
      fieldResults,
      errors,
      warnings
    );

    this.validateField(
      address.country,
      `${path}.country`,
      'string',
      true,
      { pattern: /^[A-Z]{2}$/ },
      fieldResults,
      errors,
      warnings
    );

    // If US address, validate state
    if (address.country === 'US') {
      this.validateField(
        address.us_state,
        `${path}.us_state`,
        'string',
        true,
        { pattern: /^[A-Z]{2}$/ },
        fieldResults,
        errors,
        warnings
      );
    }
  }

  private validateContactInfo(
    contact: any, 
    path: string, 
    fieldResults: FieldValidationResult[], 
    errors: string[], 
    warnings: string[]
  ): void {
    if (!contact || typeof contact !== 'object') {
      errors.push(`${path} is required and must be an object`);
      return;
    }

    this.validateField(
      contact.email,
      `${path}.email`,
      'email',
      true,
      { maxLength: 100 },
      fieldResults,
      errors,
      warnings
    );

    if (contact.phone_primary) {
      this.validateField(
        contact.phone_primary,
        `${path}.phone_primary`,
        'phone',
        false,
        {},
        fieldResults,
        errors,
        warnings
      );
    }
  }

  private validateI485FormData(
    formData: any, 
    path: string, 
    fieldResults: FieldValidationResult[], 
    errors: string[], 
    warnings: string[]
  ): void {
    this.validateField(
      formData.application_type,
      `${path}.application_type`,
      'string',
      true,
      { allowedValues: ['a', 'b', 'c', 'h', 'other'] },
      fieldResults,
      errors,
      warnings
    );

    this.validateField(
      formData.current_immigration_status,
      `${path}.current_immigration_status`,
      'string',
      true,
      { maxLength: 50 },
      fieldResults,
      errors,
      warnings
    );
  }

  private validateI130FormData(
    formData: any, 
    path: string, 
    fieldResults: FieldValidationResult[], 
    errors: string[], 
    warnings: string[]
  ): void {
    if (formData.petitioner) {
      this.validateField(
        formData.petitioner.us_citizen,
        `${path}.petitioner.us_citizen`,
        'boolean',
        true,
        {},
        fieldResults,
        errors,
        warnings
      );
    }

    if (formData.beneficiary) {
      this.validateField(
        formData.beneficiary.relationship_to_petitioner,
        `${path}.beneficiary.relationship_to_petitioner`,
        'string',
        true,
        { allowedValues: ['spouse', 'child', 'parent', 'sibling'] },
        fieldResults,
        errors,
        warnings
      );
    }
  }

  private validateI131FormData(
    formData: any, 
    path: string, 
    fieldResults: FieldValidationResult[], 
    errors: string[], 
    warnings: string[]
  ): void {
    if (formData.document_type) {
      this.validateField(
        formData.document_type,
        `${path}.document_type`,
        'string',
        true,
        { allowedValues: ['reentry_permit', 'refugee_travel', 'advance_parole'] },
        fieldResults,
        errors,
        warnings
      );
    }
  }

  private validateAttorneyInfo(
    attorney: any, 
    path: string, 
    fieldResults: FieldValidationResult[], 
    errors: string[], 
    warnings: string[]
  ): void {
    this.validateField(
      attorney.name,
      `${path}.name`,
      'string',
      true,
      { minLength: 1, maxLength: 100 },
      fieldResults,
      errors,
      warnings
    );

    this.validateField(
      attorney.phone,
      `${path}.phone`,
      'phone',
      true,
      {},
      fieldResults,
      errors,
      warnings
    );
  }

  private validateField(
    value: any,
    path: string,
    type: string,
    required: boolean,
    constraints: any,
    fieldResults: FieldValidationResult[],
    errors: string[],
    warnings: string[]
  ): void {
    const fieldErrors: string[] = [];
    const fieldWarnings: string[] = [];
    let isValid = true;

    // Check if field is required
    if (required && (value === undefined || value === null || value === '')) {
      fieldErrors.push(`${path} is required`);
      isValid = false;
    }

    // Skip further validation if value is empty and not required
    if (!required && (value === undefined || value === null || value === '')) {
      fieldResults.push({
        fieldPath: path,
        isValid: true,
        errors: [],
        warnings: [],
        value
      });
      return;
    }

    // Type-specific validation
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          fieldErrors.push(`${path} must be a string`);
          isValid = false;
        } else {
          if (constraints.minLength && value.length < constraints.minLength) {
            fieldErrors.push(`${path} must be at least ${constraints.minLength} characters`);
            isValid = false;
          }
          if (constraints.maxLength && value.length > constraints.maxLength) {
            fieldErrors.push(`${path} must be at most ${constraints.maxLength} characters`);
            isValid = false;
          }
          if (constraints.pattern && !constraints.pattern.test(value)) {
            fieldErrors.push(`${path} format is invalid`);
            isValid = false;
          }
          if (constraints.allowedValues && !constraints.allowedValues.includes(value)) {
            fieldErrors.push(`${path} must be one of: ${constraints.allowedValues.join(', ')}`);
            isValid = false;
          }
        }
        break;

      case 'email':
        if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          fieldErrors.push(`${path} must be a valid email address`);
          isValid = false;
        }
        break;

      case 'phone':
        if (typeof value !== 'string' || !/^[\+]?[\d\s\-\(\)]{10,20}$/.test(value)) {
          fieldErrors.push(`${path} must be a valid phone number`);
          isValid = false;
        }
        break;

      case 'date':
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          fieldErrors.push(`${path} must be a valid date in YYYY-MM-DD format`);
          isValid = false;
        } else {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            fieldErrors.push(`${path} must be a valid date`);
            isValid = false;
          }
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          fieldErrors.push(`${path} must be a boolean`);
          isValid = false;
        }
        break;
    }

    // Add field result
    fieldResults.push({
      fieldPath: path,
      isValid,
      errors: fieldErrors,
      warnings: fieldWarnings,
      value
    });

    // Add to overall errors and warnings
    errors.push(...fieldErrors);
    warnings.push(...fieldWarnings);
  }
}