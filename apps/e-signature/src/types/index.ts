// E-signature service types

export interface SignatureRequest {
  id: string;
  templateId?: string;
  documentUrl?: string;
  documentBuffer?: Buffer;
  signers: SignerInfo[];
  title: string;
  message?: string;
  metadata?: Record<string, any>;
  dueDate?: string;
  reminderEnabled?: boolean;
  status: SignatureStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface SignerInfo {
  id: string;
  name: string;
  email: string;
  role?: string;
  order?: number;
  fields?: SignatureField[];
  status: SignerStatus;
  signedAt?: string;
  viewedAt?: string;
  remindersSent?: number;
}

export interface SignatureField {
  id: string;
  type: FieldType;
  name: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  defaultValue?: string;
  options?: string[];
  validation?: FieldValidation;
}

export interface FieldValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export type FieldType = 
  | 'signature'
  | 'initial'
  | 'date'
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'image';

export type SignatureStatus = 
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'declined';

export type SignerStatus = 
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'expired';

export interface SignatureTemplate {
  id: string;
  name: string;
  description?: string;
  formType?: string;
  documentUrl: string;
  fields: SignatureField[];
  defaultSigners: Partial<SignerInfo>[];
  settings: TemplateSettings;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface TemplateSettings {
  allowDecline: boolean;
  requireAllSigners: boolean;
  sendReminders: boolean;
  reminderInterval: number;
  expirationDays: number;
  allowComments: boolean;
  requireAuthentication: boolean;
}

export interface DocuSealWebhookPayload {
  event_type: string;
  timestamp: string;
  data: {
    submission_id: string;
    template_id?: string;
    submitter?: {
      id: string;
      name: string;
      email: string;
      status: string;
      completed_at?: string;
    };
    submission?: {
      id: string;
      status: string;
      completed_at?: string;
      declined_at?: string;
      expired_at?: string;
    };
  };
}

export interface CreateSignatureRequestOptions {
  templateId?: string;
  documentUrl?: string;
  documentBuffer?: Buffer;
  filename?: string;
  title: string;
  message?: string;
  signers: Omit<SignerInfo, 'id' | 'status' | 'signedAt' | 'viewedAt' | 'remindersSent'>[];
  fields?: Omit<SignatureField, 'id'>[];
  dueDate?: string;
  reminderEnabled?: boolean;
  metadata?: Record<string, any>;
}

export interface DocuSealApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error?: string;
  message?: string;
}

export interface SignatureRequestSummary {
  id: string;
  title: string;
  status: SignatureStatus;
  signers: {
    total: number;
    pending: number;
    signed: number;
    declined: number;
  };
  createdAt: string;
  dueDate?: string;
  completedAt?: string;
}

export interface SignatureAnalytics {
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
  averageCompletionTime: number;
  completionRate: number;
  declineRate: number;
  statusBreakdown: Record<SignatureStatus, number>;
  monthlyTrends: Array<{
    month: string;
    requests: number;
    completed: number;
  }>;
}

export interface SignatureServiceConfig {
  docusealUrl: string;
  apiKey: string;
  webhookSecret?: string;
  defaultExpirationDays: number;
  defaultReminderInterval: number;
  maxFileSize: number;
  allowedFileTypes: string[];
}