export interface CaseStatus {
  receiptNumber: string;
  caseType: string;
  currentStatus: string;
  statusDate: string;
  statusDescription: string;
  nextActionDate?: string;
  nextActionDescription?: string;
  priorityDate?: string;
  lastUpdated: string;
  applicationDate?: string;
  petitionerName?: string;
  beneficiaryName?: string;
  formType?: string;
  serviceCenter?: string;
  lockboxFacility?: string;
  scheduledInterviewDate?: string;
  documentDeadlineDate?: string;
  biometricsDate?: string;
  decisionDate?: string;
  cardProductionDate?: string;
  cardDeliveryDate?: string;
}

export interface CaseStatusHistory {
  receiptNumber: string;
  statusHistory: StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  status: string;
  statusDate: string;
  description: string;
  recordedAt: string;
  changes?: string[];
}

export interface CaseTrackingConfig {
  receiptNumber: string;
  userId?: string;
  email?: string;
  phone?: string;
  notificationPreferences: NotificationPreferences;
  trackingEnabled: boolean;
  checkInterval: number; // in minutes
  createdAt: string;
  updatedAt: string;
  lastChecked?: string;
  totalChecks: number;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  webhook?: string;
  statusChanges: boolean;
  actionRequired: boolean;
  deadlineReminders: boolean;
  interviewScheduled: boolean;
  cardProduced: boolean;
  caseApproved: boolean;
  caseRejected: boolean;
  biometricsScheduled: boolean;
}

export interface USCISApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  lastChecked?: string;
}

export interface CaseStatusRequest {
  receiptNumber: string;
  forceRefresh?: boolean;
}

export interface BulkStatusRequest {
  receiptNumbers: string[];
  forceRefresh?: boolean;
}

export interface CaseStatusAlert {
  id: string;
  receiptNumber: string;
  alertType: AlertType;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  channels: NotificationChannel[];
  metadata?: Record<string, any>;
}

export type AlertType = 
  | 'status_change'
  | 'action_required' 
  | 'deadline_reminder'
  | 'interview_scheduled'
  | 'card_produced'
  | 'case_approved'
  | 'case_rejected'
  | 'biometrics_scheduled'
  | 'document_request'
  | 'rfe_received'
  | 'case_transferred';

export type NotificationChannel = 'email' | 'sms' | 'webhook' | 'push';

export interface CaseStatusAnalytics {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  averageProcessingTime: number; // in days
  statusDistribution: Record<string, number>;
  formTypeDistribution: Record<string, number>;
  serviceCenterDistribution: Record<string, number>;
  monthlyTrends: MonthlyTrend[];
  alertStats: AlertStats;
}

export interface MonthlyTrend {
  month: string;
  newCases: number;
  statusChanges: number;
  completedCases: number;
}

export interface AlertStats {
  totalAlerts: number;
  alertsByType: Record<AlertType, number>;
  deliveryRate: number;
  averageResponseTime: number; // in minutes
}

export interface USCISServiceConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  rateLimitDelay: number;
  userAgent: string;
  useProxy?: boolean;
  proxyUrl?: string;
  maxConcurrentChecks?: number;
}

export interface CaseStatusServiceConfig extends USCISServiceConfig {
  port: number;
  defaultCheckInterval: number;
  maxConcurrentChecks: number;
  notificationConfig: {
    email?: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      from: string;
    };
    sms?: {
      provider: 'twilio' | 'aws' | 'sendgrid';
      apiKey: string;
      apiSecret?: string;
      from: string;
    };
    webhook?: {
      timeout: number;
      maxRetries: number;
    };
  };
}

export interface ReceiptNumberValidation {
  isValid: boolean;
  formType?: string;
  serviceCenter?: string;
  year?: number;
  sequenceNumber?: string;
  errors?: string[];
}