export interface User {
  id: string;
  email: string;
  hashedPassword: string;
  role: 'client' | 'paralegal' | 'attorney' | 'admin' | 'operator' | 'user';
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface AuthToken {
  id: string;
  userId: string;
  token: string;
  type: 'access' | 'refresh' | 'api_key';
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
  sessionId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PIIDetectionResult {
  text: string;
  maskedText: string;
  detectedPII: PIIMatch[];
  confidence: number;
  timestamp: Date;
}

export interface PIIMatch {
  type: PIIType;
  value: string;
  start: number;
  end: number;
  confidence: number;
  masked: string;
}

export type PIIType = 
  | 'ssn'
  | 'email'
  | 'phone'
  | 'credit_card'
  | 'passport'
  | 'drivers_license'
  | 'alien_number'
  | 'date_of_birth'
  | 'address'
  | 'name'
  | 'bank_account';

export interface SecurityConfig {
  jwt: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  pii: {
    enabled: boolean;
    autoMask: boolean;
    sensitivity: 'low' | 'medium' | 'high';
  };
  audit: {
    enabled: boolean;
    retentionDays: number;
    logLevel: 'basic' | 'detailed';
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  message?: string;
}

export interface SecurityIncident {
  id: string;
  type: 'brute_force' | 'suspicious_activity' | 'data_breach' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  metadata: Record<string, any>;
}

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag?: string;
}

export interface DatabaseConfig {
  mongodb: {
    uri: string;
    options?: Record<string, any>;
  };
  redis: {
    uri: string;
    options?: Record<string, any>;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  uptime: number;
  lastCheck: Date;
  dependencies: {
    mongodb: boolean;
    redis: boolean;
  };
  metrics: {
    totalUsers: number;
    activeTokens: number;
    auditLogs24h: number;
    securityIncidents24h: number;
  };
}

// Permission constants
export const PERMISSIONS = {
  // User management
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',
  
  // OCR operations
  OCR_PROCESS: 'ocr:process',
  OCR_READ: 'ocr:read',
  
  // PDF operations
  PDF_FILL: 'pdf:fill',
  PDF_READ: 'pdf:read',
  
  // E-signature operations
  ESIGN_CREATE: 'esign:create',
  ESIGN_READ: 'esign:read',
  ESIGN_SIGN: 'esign:sign',
  
  // Case status operations
  CASE_STATUS_READ: 'case-status:read',
  CASE_STATUS_TRACK: 'case-status:track',
  
  // Voice translation operations
  VOICE_TRANSLATE: 'voice:translate',
  VOICE_SESSION_MANAGE: 'voice:session:manage',
  
  // Admin operations
  ADMIN_DASHBOARD: 'admin:dashboard',
  ADMIN_LOGS: 'admin:logs',
  ADMIN_SYSTEM: 'admin:system',
  
  // Security operations
  SECURITY_READ: 'security:read',
  SECURITY_WRITE: 'security:write',
  SECURITY_INCIDENTS: 'security:incidents',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];