// Constants and enums for the Immigration Suite

export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'ar'] as const;

export const RTL_LOCALES = ['ar'];

export const DOCUMENT_TYPES = {
  PASSPORT: 'passport',
  ID_CARD: 'id_card',
  BIRTH_CERTIFICATE: 'birth_certificate',
  MARRIAGE_CERTIFICATE: 'marriage_certificate',
  OTHER: 'other'
} as const;

export const USCIS_FORM_TYPES = {
  I_485: 'i-485',
  I_130: 'i-130',
  I_131: 'i-131',
  G_28: 'g-28'
} as const;

export const CASE_EVENTS = {
  CREATED: 'created',
  UPDATED: 'updated',
  OCR_PROCESSED: 'ocr_processed',
  PDF_GENERATED: 'pdf_generated',
  SIGNED: 'signed',
  SUBMITTED: 'submitted'
} as const;

export const DATA_SOURCES = {
  USER_TYPED: 'user_typed',
  OCR_EXTRACTED: 'ocr_extracted',
  AI_INFERRED: 'ai_inferred'
} as const;

export const OCR_CONFIDENCE_THRESHOLDS = {
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.5
} as const;

export const SERVICE_PORTS = {
  WEB_APP: 3000,
  ADMIN_APP: 3003,
  FORMIO: 3001,
  DOCUSEAL: 3002,
  OCR_SERVICE: 8001,
  PDF_SERVICE: 8002,
  USCIS_SERVICE: 8003,
  VOICE_SERVICE: 8004
} as const;