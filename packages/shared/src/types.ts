// Core types for the Immigration Suite

export type SupportedLocale = 'en' | 'es' | 'fr' | 'ar';

export interface ApplicantName {
  given_name: string;
  family_name: string;
  middle_name?: string;
  given_name_native?: string;
  family_name_native?: string;
  middle_name_native?: string;
}

export interface Address {
  street: string;
  street2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface DocumentInfo {
  id: string;
  type: 'passport' | 'id_card' | 'birth_certificate' | 'marriage_certificate' | 'other';
  country_issued: string;
  document_number: string;
  issue_date: string;
  expiry_date?: string;
}

export interface OCRResult {
  field_name: string;
  value: string;
  confidence: number;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FormFieldProvenance {
  field_name: string;
  source: 'user_typed' | 'ocr_extracted' | 'ai_inferred';
  confidence?: number;
  timestamp: string;
}

export interface CaseStatus {
  receipt_number: string;
  case_type: string;
  status: string;
  status_date: string;
  description: string;
}

export interface PacketLog {
  id: string;
  case_id: string;
  event: 'created' | 'updated' | 'ocr_processed' | 'pdf_generated' | 'signed' | 'submitted';
  actor: string;
  metadata: Record<string, any>;
  timestamp: string;
}