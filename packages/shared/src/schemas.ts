import { z } from 'zod';

// Core validation schemas for the Immigration Suite
// These schemas define the canonical data structure used across all services

// ============================================================================
// BASIC TYPES & ENUMS
// ============================================================================

export const SupportedLocaleSchema = z.enum(['en', 'es', 'fr', 'ar']);

export const CountryCodeSchema = z.string().length(2, 'Country code must be 2 characters (ISO 3166-1)');

export const USStateSchema = z.enum([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
  'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]);

export const DocumentTypeSchema = z.enum([
  'passport', 'id_card', 'birth_certificate', 'marriage_certificate', 'divorce_decree',
  'naturalization_certificate', 'green_card', 'driver_license', 'other'
]);

export const DataSourceSchema = z.enum(['user_typed', 'ocr_extracted', 'ai_inferred', 'pre_filled']);

// ============================================================================
// PERSONAL INFORMATION SCHEMAS
// ============================================================================

export const PersonNameSchema = z.object({
  given_name: z.string().min(1, 'Given name is required').max(50),
  middle_name: z.string().max(50).optional(),
  family_name: z.string().min(1, 'Family name is required').max(50),
  suffix: z.string().max(10).optional(), // Jr, Sr, III, etc.
  // Native script names for non-Latin alphabets
  given_name_native: z.string().max(100).optional(),
  middle_name_native: z.string().max(100).optional(),
  family_name_native: z.string().max(100).optional(),
  // Name variations and aliases
  other_names_used: z.array(z.string().max(100)).optional(),
  maiden_name: z.string().max(50).optional()
});

export const PersonalInfoSchema = z.object({
  name: PersonNameSchema,
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  place_of_birth: z.object({
    city: z.string().min(1, 'City is required').max(50),
    state_province: z.string().max(50).optional(),
    country: CountryCodeSchema
  }),
  gender: z.enum(['M', 'F', 'X']).optional(), // M=Male, F=Female, X=Unspecified
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed', 'separated']).optional(),
  citizenship: z.array(CountryCodeSchema).min(1, 'At least one citizenship is required'),
  a_number: z.string().regex(/^A\d{8,9}$/, 'A-Number must be in format A12345678').optional(),
  ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, 'SSN must be in format XXX-XX-XXXX').optional()
});

// ============================================================================
// ADDRESS & CONTACT SCHEMAS  
// ============================================================================

export const AddressSchema = z.object({
  type: z.enum(['current', 'mailing', 'previous', 'work', 'other']).default('current'),
  street_address: z.string().min(1, 'Street address is required').max(100),
  street_address_2: z.string().max(100).optional(),
  city: z.string().min(1, 'City is required').max(50),
  state_province: z.string().max(50).optional(),
  postal_code: z.string().min(1, 'Postal code is required').max(20),
  country: CountryCodeSchema,
  // For US addresses, enforce state validation
  us_state: z.union([USStateSchema, z.undefined()]).optional(),
  // Date ranges for previous addresses
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}).refine((data) => {
  // If country is US, us_state must be provided
  if (data.country === 'US') {
    return data.us_state !== undefined;
  }
  return true;
}, {
  message: 'US State is required for US addresses',
  path: ['us_state']
});

export const ContactInfoSchema = z.object({
  phone_primary: z.string().regex(/^\+?[\d\s\-\(\)]{10,20}$/, 'Invalid phone number').optional(),
  phone_mobile: z.string().regex(/^\+?[\d\s\-\(\)]{10,20}$/, 'Invalid phone number').optional(),
  email: z.string().email('Invalid email address').max(100),
  preferred_contact_method: z.enum(['email', 'phone', 'mail']).default('email')
});

// ============================================================================
// DOCUMENT SCHEMAS
// ============================================================================

export const IdentityDocumentSchema = z.object({
  id: z.string().uuid(),
  type: DocumentTypeSchema,
  document_number: z.string().min(1, 'Document number is required').max(50),
  country_issued: CountryCodeSchema,
  issuing_authority: z.string().max(100).optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  is_expired: z.boolean().default(false),
  // Additional passport-specific fields
  passport_type: z.enum(['ordinary', 'diplomatic', 'official', 'emergency']).optional(),
  // File attachment info
  file_url: z.string().url().optional(),
  ocr_extracted_data: z.record(z.unknown()).optional()
});

// ============================================================================
// IMMIGRATION-SPECIFIC SCHEMAS
// ============================================================================

export const ImmigrationHistorySchema = z.object({
  entries: z.array(z.object({
    entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    port_of_entry: z.string().max(100),
    immigration_status: z.string().max(50),
    i94_number: z.string().max(20).optional(),
    authorized_stay_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    visa_number: z.string().max(20).optional()
  })).optional(),
  current_status: z.string().max(50).optional(),
  last_departure: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pending_applications: z.array(z.object({
    form_type: z.string(),
    receipt_number: z.string().optional(),
    filing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  })).optional()
});

export const FamilyMemberSchema = z.object({
  id: z.string().uuid(),
  relationship: z.enum(['spouse', 'child', 'parent', 'sibling', 'stepchild', 'stepparent']),
  name: PersonNameSchema,
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  place_of_birth: z.object({
    city: z.string().max(50),
    country: CountryCodeSchema
  }),
  citizenship: CountryCodeSchema,
  immigration_status: z.string().max(50).optional(),
  a_number: z.string().regex(/^A\d{8,9}$/).optional(),
  is_beneficiary: z.boolean().default(false),
  current_address: AddressSchema.optional()
});

// ============================================================================
// FORM-SPECIFIC SCHEMAS
// ============================================================================

export const I485DataSchema = z.object({
  // Part 1: Information About You (The Applicant)
  personal_info: PersonalInfoSchema,
  current_address: AddressSchema,
  mailing_address: AddressSchema.optional(),
  contact_info: ContactInfoSchema,
  
  // Part 2: Application Type
  application_type: z.enum(['a', 'b', 'c', 'h', 'other']),
  basis_for_application: z.string().max(500).optional(),
  
  // Part 3: Processing Information  
  current_immigration_status: z.string().max(50),
  i94_arrival_record: z.string().max(20).optional(),
  last_entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  last_entry_place: z.string().max(100),
  authorized_stay_expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  
  // Part 4: Accommodations for Individuals with Disabilities
  interpreter_needed: z.boolean().default(false),
  interpreter_language: z.string().max(50).optional(),
  disability_accommodations: z.boolean().default(false),
  accommodation_details: z.string().max(500).optional(),
  
  // Documents and supporting evidence
  identity_documents: z.array(IdentityDocumentSchema),
  supporting_documents: z.array(z.string().uuid()).optional()
});

export const I130DataSchema = z.object({
  // Part 1: Relationship
  petitioner: PersonalInfoSchema.extend({
    us_citizen: z.boolean(),
    permanent_resident_since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    naturalization_certificate_number: z.string().max(20).optional()
  }),
  
  beneficiary: FamilyMemberSchema.extend({
    relationship_to_petitioner: z.enum(['spouse', 'child', 'parent', 'sibling']),
    current_address: AddressSchema
  }),
  
  // Part 2: Additional Information
  previous_petitions: z.array(z.object({
    beneficiary_name: z.string().max(100),
    relationship: z.string().max(50),
    filing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    result: z.enum(['approved', 'denied', 'pending', 'withdrawn'])
  })).optional(),
  
  marriage_info: z.object({
    date_of_marriage: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    place_of_marriage: z.string().max(100),
    previous_marriages: z.array(z.object({
      spouse_name: z.string().max(100),
      marriage_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      how_ended: z.enum(['divorce', 'death', 'annulment'])
    }))
  }).optional()
});

// ============================================================================
// OCR & DATA PROVENANCE SCHEMAS
// ============================================================================

export const BoundingBoxSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(0),
  height: z.number().min(0),
  page: z.number().min(1).optional() // For multi-page documents
});

export const OCRResultSchema = z.object({
  field_name: z.string(),
  raw_text: z.string(),
  normalized_value: z.unknown(), // Will be parsed according to field type
  confidence: z.number().min(0).max(1),
  bounding_box: BoundingBoxSchema.optional(),
  ocr_engine: z.string().optional(), // paddleocr, tesseract, etc.
  language_detected: z.string().optional(),
  post_processing_applied: z.array(z.string()).optional() // ['date_parsing', 'name_standardization']
});

export const FieldProvenanceSchema = z.object({
  field_path: z.string(), // JSONPath to the field (e.g., 'personal_info.name.given_name')
  source: DataSourceSchema,
  confidence: z.number().min(0).max(1).optional(),
  timestamp: z.string().datetime(),
  source_document_id: z.string().uuid().optional(),
  user_id: z.string().optional(),
  ocr_result: OCRResultSchema.optional(),
  validation_errors: z.array(z.string()).optional()
});

// ============================================================================
// CANONICAL APPLICATION SCHEMA
// ============================================================================

export const CanonicalApplicationSchema = z.object({
  id: z.string().uuid(),
  form_type: z.enum(['i485', 'i130', 'i131', 'g28']),
  version: z.string().default('1.0'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  submitted_at: z.string().datetime().optional(),
  
  // Status tracking
  status: z.enum(['draft', 'in_progress', 'ready_for_review', 'submitted', 'approved', 'rejected']).default('draft'),
  completion_percentage: z.number().min(0).max(100).default(0),
  
  // Applicant information
  applicant: PersonalInfoSchema,
  addresses: z.array(AddressSchema),
  contact_info: ContactInfoSchema,
  
  // Form-specific data (polymorphic)
  form_data: z.union([I485DataSchema, I130DataSchema, z.record(z.unknown())]),
  
  // Data provenance and audit trail
  field_provenance: z.array(FieldProvenanceSchema).default([]),
  documents_uploaded: z.array(IdentityDocumentSchema).default([]),
  
  // Processing metadata
  locale: SupportedLocaleSchema.default('en'),
  timezone: z.string().default('America/New_York'),
  user_agent: z.string().optional(),
  ip_address: z.string().ip().optional(),
  
  // PDF generation metadata
  pdf_generated_at: z.string().datetime().optional(),
  pdf_file_url: z.string().url().optional(),
  pdf_form_version: z.string().optional()
});

// ============================================================================
// VALIDATION HELPERS & TYPE EXPORTS
// ============================================================================

export type SupportedLocale = z.infer<typeof SupportedLocaleSchema>;
export type PersonName = z.infer<typeof PersonNameSchema>;
export type PersonalInfo = z.infer<typeof PersonalInfoSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type ContactInfo = z.infer<typeof ContactInfoSchema>;
export type IdentityDocument = z.infer<typeof IdentityDocumentSchema>;
export type I485Data = z.infer<typeof I485DataSchema>;
export type I130Data = z.infer<typeof I130DataSchema>;
export type OCRResult = z.infer<typeof OCRResultSchema>;
export type FieldProvenance = z.infer<typeof FieldProvenanceSchema>;
export type CanonicalApplication = z.infer<typeof CanonicalApplicationSchema>;

// Validation helper functions
export const validateCanonicalData = (data: unknown): CanonicalApplication => {
  return CanonicalApplicationSchema.parse(data);
};

export const validateFormData = (formType: string, data: unknown) => {
  switch (formType) {
    case 'i485':
      return I485DataSchema.parse(data);
    case 'i130':
      return I130DataSchema.parse(data);
    default:
      throw new Error(`Unsupported form type: ${formType}`);
  }
};

// Schema version for compatibility checks
export const SCHEMA_VERSION = '1.0.0';