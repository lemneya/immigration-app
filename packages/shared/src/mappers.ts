import { z } from 'zod';
import { 
  CanonicalApplication, 
  PersonalInfo, 
  PersonName, 
  Address, 
  ContactInfo,
  I485Data,
  I130Data,
  FieldProvenance,
  DataSourceSchema
} from './schemas';

// ============================================================================
// FORM DATA TO CANONICAL MAPPING
// ============================================================================

/**
 * Converts raw form submission data to canonical application format
 */
export interface FormToCanonicalOptions {
  formType: string;
  locale: string;
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export function mapFormDataToCanonical(
  formData: any, 
  options: FormToCanonicalOptions
): Partial<CanonicalApplication> {
  const now = new Date().toISOString();
  const applicationId = generateUUID();

  // Base canonical structure
  const canonical: Partial<CanonicalApplication> = {
    id: applicationId,
    form_type: options.formType as any,
    version: '1.0',
    created_at: now,
    updated_at: now,
    status: 'draft',
    locale: options.locale as any,
    timezone: 'America/New_York',
    user_agent: options.userAgent,
    ip_address: options.ipAddress,
    field_provenance: [],
    documents_uploaded: [],
    completion_percentage: 0
  };

  // Form-specific mapping
  switch (options.formType) {
    case 'i485':
      return mapI485FormData(formData, canonical, options);
    case 'i130':
      return mapI130FormData(formData, canonical, options);
    default:
      throw new Error(`Unsupported form type: ${options.formType}`);
  }
}

/**
 * Maps I-485 form data to canonical format
 */
function mapI485FormData(
  formData: any, 
  canonical: Partial<CanonicalApplication>,
  options: FormToCanonicalOptions
): Partial<CanonicalApplication> {
  const provenance: FieldProvenance[] = [];
  const now = new Date().toISOString();

  // Map personal information
  const personalInfo: PersonalInfo = {
    name: {
      given_name: formData.givenName || '',
      middle_name: formData.middleName || undefined,
      family_name: formData.familyName || '',
      other_names_used: formData.otherNames ? [formData.otherNames] : undefined
    },
    date_of_birth: formData.dateOfBirth || '',
    place_of_birth: {
      city: '', // Would need to be extracted from form
      country: formData.countryOfBirth || 'US'
    },
    citizenship: [formData.countryOfCitizenship || 'US'],
    a_number: formData.aNumber || undefined
  };

  // Track field provenance
  if (formData.givenName) {
    provenance.push(createProvenance('applicant.name.given_name', 'user_typed', now, options.userId));
  }
  if (formData.familyName) {
    provenance.push(createProvenance('applicant.name.family_name', 'user_typed', now, options.userId));
  }
  if (formData.dateOfBirth) {
    provenance.push(createProvenance('applicant.date_of_birth', 'user_typed', now, options.userId));
  }

  // Map address
  const addresses: Address[] = [];
  if (formData.currentAddress) {
    const addr = formData.currentAddress;
    addresses.push({
      type: 'current',
      street_address: addr.address1 || '',
      street_address_2: addr.address2 || undefined,
      city: addr.city || '',
      state_province: addr.state || undefined,
      us_state: addr.state || undefined,
      postal_code: addr.zipCode || '',
      country: 'US'
    });

    // Track address provenance
    if (addr.address1) {
      provenance.push(createProvenance('addresses[0].street_address', 'user_typed', now, options.userId));
    }
  }

  // Map contact info
  const contactInfo: ContactInfo = {
    email: formData.emailAddress || '',
    phone_primary: formData.phoneNumber || undefined,
    preferred_contact_method: 'email'
  };

  if (formData.emailAddress) {
    provenance.push(createProvenance('contact_info.email', 'user_typed', now, options.userId));
  }

  // Create I-485 specific data
  const i485Data: Partial<I485Data> = {
    personal_info: personalInfo,
    current_address: addresses[0],
    contact_info: contactInfo,
    application_type: formData.applicationType || 'a',
    current_immigration_status: formData.currentStatus || '',
    identity_documents: []
  };

  return {
    ...canonical,
    applicant: personalInfo,
    addresses,
    contact_info: contactInfo,
    form_data: i485Data,
    field_provenance: provenance,
    completion_percentage: calculateCompletionPercentage(formData, 'i485')
  };
}

/**
 * Maps I-130 form data to canonical format
 */
function mapI130FormData(
  formData: any, 
  canonical: Partial<CanonicalApplication>,
  options: FormToCanonicalOptions
): Partial<CanonicalApplication> {
  const provenance: FieldProvenance[] = [];
  const now = new Date().toISOString();

  // Map petitioner information
  const petitionerInfo: PersonalInfo = {
    name: {
      given_name: formData.petitionerGivenName || '',
      middle_name: formData.petitionerMiddleName || undefined,
      family_name: formData.petitionerFamilyName || ''
    },
    date_of_birth: formData.petitionerDateOfBirth || '',
    place_of_birth: {
      city: formData.petitionerPlaceOfBirth || '',
      country: 'US' // Default assumption
    },
    citizenship: ['US'] // Default assumption for petitioner
  };

  // Map beneficiary information
  const beneficiaryName: PersonName = {
    given_name: formData.beneficiaryGivenName || '',
    middle_name: formData.beneficiaryMiddleName || undefined,
    family_name: formData.beneficiaryFamilyName || ''
  };

  // Track provenance for key fields
  if (formData.petitionerGivenName) {
    provenance.push(createProvenance('applicant.name.given_name', 'user_typed', now, options.userId));
  }
  if (formData.beneficiaryGivenName) {
    provenance.push(createProvenance('form_data.beneficiary.name.given_name', 'user_typed', now, options.userId));
  }
  if (formData.relationship) {
    provenance.push(createProvenance('form_data.beneficiary.relationship_to_petitioner', 'user_typed', now, options.userId));
  }

  // Create I-130 specific data
  const i130Data: Partial<I130Data> = {
    petitioner: {
      ...petitionerInfo,
      us_citizen: true // Default assumption
    },
    beneficiary: {
      id: generateUUID(),
      relationship: formData.relationship || 'spouse',
      relationship_to_petitioner: formData.relationship || 'spouse',
      name: beneficiaryName,
      date_of_birth: formData.beneficiaryDateOfBirth || '',
      place_of_birth: {
        city: '',
        country: formData.beneficiaryCountryOfBirth || 'US'
      },
      citizenship: formData.beneficiaryCountryOfBirth || 'US',
      immigration_status: 'unknown',
      is_beneficiary: true,
      current_address: {
        type: 'current',
        street_address: '',
        city: '',
        postal_code: '',
        country: 'US'
      }
    }
  };

  return {
    ...canonical,
    applicant: petitionerInfo,
    addresses: [],
    contact_info: {
      email: '', // Would need to be added to I-130 form
      preferred_contact_method: 'email'
    },
    form_data: i130Data,
    field_provenance: provenance,
    completion_percentage: calculateCompletionPercentage(formData, 'i130')
  };
}

// ============================================================================
// CANONICAL TO FORM DATA MAPPING
// ============================================================================

/**
 * Converts canonical application data back to form format for editing
 */
export function mapCanonicalToFormData(
  canonical: CanonicalApplication, 
  formType: string
): any {
  switch (formType) {
    case 'i485':
      return mapCanonicalToI485Form(canonical);
    case 'i130':
      return mapCanonicalToI130Form(canonical);
    default:
      throw new Error(`Unsupported form type: ${formType}`);
  }
}

function mapCanonicalToI485Form(canonical: CanonicalApplication): any {
  const formData = canonical.form_data as I485Data;
  
  return {
    // Personal Information
    givenName: canonical.applicant.name.given_name,
    middleName: canonical.applicant.name.middle_name,
    familyName: canonical.applicant.name.family_name,
    otherNames: canonical.applicant.name.other_names_used?.[0] || '',
    dateOfBirth: canonical.applicant.date_of_birth,
    countryOfBirth: canonical.applicant.place_of_birth.country,
    countryOfCitizenship: canonical.applicant.citizenship[0],
    
    // Address Information
    currentAddress: {
      address1: canonical.addresses[0]?.street_address || '',
      address2: canonical.addresses[0]?.street_address_2 || '',
      city: canonical.addresses[0]?.city || '',
      state: canonical.addresses[0]?.us_state || '',
      zipCode: canonical.addresses[0]?.postal_code || ''
    },
    
    // Contact Information
    phoneNumber: canonical.contact_info.phone_primary,
    emailAddress: canonical.contact_info.email,
    
    // Application Type
    applicationType: formData.application_type,
    
    // Immigration Status
    currentStatus: formData.current_immigration_status
  };
}

function mapCanonicalToI130Form(canonical: CanonicalApplication): any {
  const formData = canonical.form_data as I130Data;
  
  return {
    // Petitioner Information
    petitionerGivenName: canonical.applicant.name.given_name,
    petitionerMiddleName: canonical.applicant.name.middle_name,
    petitionerFamilyName: canonical.applicant.name.family_name,
    petitionerDateOfBirth: canonical.applicant.date_of_birth,
    petitionerPlaceOfBirth: canonical.applicant.place_of_birth.city,
    
    // Beneficiary Information
    beneficiaryGivenName: formData.beneficiary.name.given_name,
    beneficiaryMiddleName: formData.beneficiary.name.middle_name,
    beneficiaryFamilyName: formData.beneficiary.name.family_name,
    beneficiaryDateOfBirth: formData.beneficiary.date_of_birth,
    beneficiaryCountryOfBirth: formData.beneficiary.place_of_birth.country,
    
    // Relationship
    relationship: formData.beneficiary.relationship_to_petitioner
  };
}

// ============================================================================
// OCR TO CANONICAL MAPPING
// ============================================================================

/**
 * Maps OCR results to canonical format with provenance tracking
 */
export interface OCRToCanonicalOptions {
  documentId: string;
  ocrEngine: string;
  userId?: string;
  confidenceThreshold: number;
}

export function mapOCRResultsToCanonical(
  ocrResults: any[],
  existingCanonical: Partial<CanonicalApplication>,
  options: OCRToCanonicalOptions
): Partial<CanonicalApplication> {
  const now = new Date().toISOString();
  const updatedProvenance = [...(existingCanonical.field_provenance || [])];
  const updatedCanonical = { ...existingCanonical };

  // Process each OCR result
  for (const result of ocrResults) {
    if (result.confidence < options.confidenceThreshold) {
      continue; // Skip low-confidence results
    }

    const fieldPath = mapOCRFieldToCanonicalPath(result.field_name);
    if (!fieldPath) {
      continue; // Skip unmappable fields
    }

    // Update the canonical data
    setNestedValue(updatedCanonical, fieldPath, result.normalized_value);

    // Add provenance record
    updatedProvenance.push({
      field_path: fieldPath,
      source: 'ocr_extracted',
      confidence: result.confidence,
      timestamp: now,
      source_document_id: options.documentId,
      user_id: options.userId,
      ocr_result: {
        field_name: result.field_name,
        raw_text: result.raw_text,
        normalized_value: result.normalized_value,
        confidence: result.confidence,
        bounding_box: result.bounding_box,
        ocr_engine: options.ocrEngine
      }
    });
  }

  return {
    ...updatedCanonical,
    field_provenance: updatedProvenance,
    updated_at: now
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createProvenance(
  fieldPath: string, 
  source: string, 
  timestamp: string, 
  userId?: string
): FieldProvenance {
  return {
    field_path: fieldPath,
    source: source as any,
    timestamp,
    user_id: userId
  };
}

function calculateCompletionPercentage(formData: any, formType: string): number {
  const requiredFields = getRequiredFieldsForForm(formType);
  const completedFields = requiredFields.filter(field => {
    const value = getNestedValue(formData, field);
    return value !== undefined && value !== null && value !== '';
  });
  
  return Math.round((completedFields.length / requiredFields.length) * 100);
}

function getRequiredFieldsForForm(formType: string): string[] {
  switch (formType) {
    case 'i485':
      return [
        'givenName',
        'familyName', 
        'dateOfBirth',
        'countryOfBirth',
        'countryOfCitizenship',
        'currentAddress.address1',
        'currentAddress.city',
        'currentAddress.state',
        'currentAddress.zipCode',
        'emailAddress',
        'applicationType'
      ];
    case 'i130':
      return [
        'petitionerGivenName',
        'petitionerFamilyName',
        'petitionerDateOfBirth',
        'beneficiaryGivenName', 
        'beneficiaryFamilyName',
        'beneficiaryDateOfBirth',
        'relationship'
      ];
    default:
      return [];
  }
}

function mapOCRFieldToCanonicalPath(ocrFieldName: string): string | null {
  const fieldMappings: { [key: string]: string } = {
    'given_name': 'applicant.name.given_name',
    'first_name': 'applicant.name.given_name',
    'family_name': 'applicant.name.family_name',
    'last_name': 'applicant.name.family_name',
    'surname': 'applicant.name.family_name',
    'middle_name': 'applicant.name.middle_name',
    'date_of_birth': 'applicant.date_of_birth',
    'birth_date': 'applicant.date_of_birth',
    'dob': 'applicant.date_of_birth',
    'passport_number': 'documents_uploaded[0].document_number',
    'document_number': 'documents_uploaded[0].document_number',
    'nationality': 'applicant.citizenship[0]',
    'citizenship': 'applicant.citizenship[0]',
    'country_of_birth': 'applicant.place_of_birth.country',
    'place_of_birth': 'applicant.place_of_birth.city'
  };

  return fieldMappings[ocrFieldName.toLowerCase()] || null;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (key.includes('[') && key.includes(']')) {
      // Handle array access like 'citizenship[0]'
      const [arrayKey, indexStr] = key.split('[');
      const index = parseInt(indexStr.replace(']', ''));
      return current?.[arrayKey]?.[index];
    }
    return current?.[key];
  }, obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (key.includes('[') && key.includes(']')) {
      const [arrayKey, indexStr] = key.split('[');
      const index = parseInt(indexStr.replace(']', ''));
      if (!current[arrayKey]) current[arrayKey] = [];
      if (!current[arrayKey][index]) current[arrayKey][index] = {};
      current = current[arrayKey][index];
    } else {
      if (!current[key]) current[key] = {};
      current = current[key];
    }
  }
  
  const finalKey = keys[keys.length - 1];
  if (finalKey.includes('[') && finalKey.includes(']')) {
    const [arrayKey, indexStr] = finalKey.split('[');
    const index = parseInt(indexStr.replace(']', ''));
    if (!current[arrayKey]) current[arrayKey] = [];
    current[arrayKey][index] = value;
  } else {
    current[finalKey] = value;
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}