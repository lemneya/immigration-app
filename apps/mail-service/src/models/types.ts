/**
 * Type definitions for Mail Processing Service
 */

export interface MailJob {
  id: string;
  applicant_id: string;
  source: 'upload' | 'email' | 'drive';
  original_file_url: string;
  detected_lang?: string;
  doc_type?: DocumentType;
  ocr_text_url?: string;
  translation_en_url?: string;
  translation_user_url?: string;
  summary_en?: string;
  summary_user?: string;
  due_date?: Date;
  amount?: number;
  case_or_account_number?: string;
  risk_flags?: RiskFlags;
  confidence_scores?: ConfidenceScores;
  status: JobStatus;
  created_at: Date;
  updated_at: Date;
  processed_at?: Date;
}

export interface MailAction {
  id: string;
  mail_job_id: string;
  label: string;
  description?: string;
  due_at?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'done' | 'skipped';
  action_type?: ActionType;
  meta?: Record<string, any>;
  created_at: Date;
  completed_at?: Date;
}

export type DocumentType = 
  | 'uscis_notice'
  | 'insurance_notice' 
  | 'bank_statement'
  | 'credit_card_notice'
  | 'utility_bill'
  | 'tax_document'
  | 'legal_notice'
  | 'other';

export type JobStatus = 
  | 'received'
  | 'processing'
  | 'needs_review'
  | 'ready'
  | 'error';

export type ActionType =
  | 'link_case'
  | 'call_service'
  | 'upload_document'
  | 'review_amount'
  | 'schedule_appointment'
  | 'pay_bill'
  | 'respond_by_deadline'
  | 'verify_authenticity';

export interface RiskFlags {
  potential_scam?: boolean;
  suspicious_sender?: boolean;
  urgent_payment_request?: boolean;
  unusual_language?: boolean;
  missing_official_elements?: boolean;
  risk_score?: number;
}

export interface ConfidenceScores {
  ocr_quality?: number;
  language_detection?: number;
  document_classification?: number;
  date_extraction?: number;
  amount_extraction?: number;
  sender_identification?: number;
  overall_confidence?: number;
}

export interface ExtractedInfo {
  sender?: {
    name?: string;
    organization?: string;
    address?: string;
    phone?: string;
    email?: string;
    official?: boolean;
  };
  recipient?: {
    name?: string;
    address?: string;
  };
  dates?: {
    document_date?: Date;
    due_date?: Date;
    appointment_date?: Date;
    effective_date?: Date;
  };
  amounts?: {
    total_due?: number;
    minimum_payment?: number;
    balance?: number;
    currency?: string;
  };
  identifiers?: {
    case_number?: string;
    account_number?: string;
    claim_number?: string;
    policy_number?: string;
    receipt_number?: string;
  };
  instructions?: string[];
  required_actions?: string[];
  attachments_mentioned?: string[];
}

export interface ProcessingOptions {
  user_language?: string;
  ocr_engine?: 'doctr' | 'tesseract';
  translation_provider?: 'libre' | 'marian' | 'nllb';
  skip_translation?: boolean;
  include_risk_analysis?: boolean;
  confidence_threshold?: number;
  generate_summary?: boolean;
  extract_actions?: boolean;
}

export interface IngestRequest {
  applicant_id: string;
  source: 'upload' | 'email' | 'drive';
  file?: Express.Multer.File;
  file_url?: string;
  options?: ProcessingOptions;
}

export interface MailJobResponse {
  job_id: string;
  status: JobStatus;
  progress?: number;
  estimated_completion?: string;
  message?: string;
}

export interface MailJobDetails extends MailJob {
  actions: MailAction[];
  processing_steps?: ProcessingStep[];
}

export interface ProcessingStep {
  step: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  started_at?: Date;
  completed_at?: Date;
  error?: string;
  result?: Record<string, any>;
}

export interface DocumentClassificationResult {
  doc_type: DocumentType;
  confidence: number;
  matched_keywords: string[];
  embedding_similarity?: number;
  fallback_used?: boolean;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  script?: string;
  alternatives?: Array<{
    language: string;
    confidence: number;
  }>;
}

export interface OCRResult {
  text: string;
  confidence: number;
  blocks?: Array<{
    text: string;
    bbox: [number, number, number, number];
    confidence: number;
    type?: 'text' | 'table' | 'figure';
  }>;
  layout_preserved?: boolean;
}

export interface TranslationResult {
  translated_text: string;
  source_language: string;
  target_language: string;
  confidence?: number;
  provider: string;
  segments?: Array<{
    source: string;
    target: string;
    confidence: number;
  }>;
}

export interface SummaryResult {
  summary: string;
  key_points: string[];
  action_items: string[];
  urgency_level: 'low' | 'medium' | 'high' | 'critical';
  plain_language_score?: number;
}

export interface ActionExtraction {
  actions: Array<{
    label: string;
    description: string;
    due_date?: Date;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    action_type: ActionType;
    confidence: number;
    context: string;
  }>;
  deadline_urgency?: 'safe' | 'upcoming' | 'urgent' | 'overdue';
}

export interface EmailIngestWebhook {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    size: number;
  }>;
  headers: Record<string, string>;
  messageId: string;
  timestamp: Date;
}

export interface RiskAnalysis {
  is_suspicious: boolean;
  risk_factors: string[];
  scam_indicators: Array<{
    indicator: string;
    confidence: number;
    description: string;
  }>;
  authenticity_markers: Array<{
    marker: string;
    present: boolean;
    weight: number;
  }>;
  recommendation: 'proceed' | 'verify' | 'block';
  risk_score: number; // 0-1 scale
}

export interface ServiceHealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  dependencies: Record<string, 'up' | 'down'>;
  last_processed_job?: Date;
  processing_queue_size?: number;
  uptime: number;
}