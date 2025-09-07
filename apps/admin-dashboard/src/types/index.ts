export interface ServiceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastChecked: string;
  version?: string;
  uptime?: number;
  error?: string;
}

export interface SystemMetrics {
  totalRequests: number;
  totalUsers: number;
  activeServices: number;
  totalStorage: string;
  averageResponseTime: number;
  errorRate: number;
  lastUpdated: string;
}

export interface ServiceMetrics {
  serviceName: string;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  uptime: number;
  memoryUsage?: number;
  cpuUsage?: number;
  activeConnections?: number;
  throughput: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'user';
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: string;
  createdAt: string;
  permissions: string[];
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'error' | 'warning';
}

export interface CaseStatusSummary {
  receiptNumber: string;
  status: string;
  lastUpdated: string;
  userId?: string;
  trackingEnabled: boolean;
}

export interface SignatureRequestSummary {
  id: string;
  title: string;
  status: string;
  signers: {
    total: number;
    signed: number;
    pending: number;
  };
  createdAt: string;
  dueDate?: string;
}

export interface AlertSummary {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'active' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
}

export interface DashboardStats {
  services: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  users: {
    total: number;
    active: number;
    newToday: number;
  };
  cases: {
    totalTracked: number;
    statusChangesToday: number;
    pendingApprovals: number;
  };
  signatures: {
    totalRequests: number;
    completedToday: number;
    pendingSigs: number;
  };
  documents: {
    totalProcessed: number;
    processedToday: number;
    averageProcessingTime: number;
  };
  alerts: {
    total: number;
    active: number;
    high_priority: number;
  };
}

export interface ChartData {
  name: string;
  value: number;
  date?: string;
  category?: string;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
}

export interface ServiceConfiguration {
  serviceName: string;
  baseUrl: string;
  healthEndpoint: string;
  metricsEndpoint?: string;
  enabled: boolean;
  timeout: number;
  retryAttempts: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    downtime: number;
  };
}

export interface NotificationSettings {
  email: {
    enabled: boolean;
    recipients: string[];
    templates: Record<string, string>;
  };
  slack: {
    enabled: boolean;
    webhookUrl?: string;
    channel?: string;
  };
  sms: {
    enabled: boolean;
    provider?: string;
    numbers: string[];
  };
}

export interface AdminDashboardConfig {
  services: ServiceConfiguration[];
  notifications: NotificationSettings;
  monitoring: {
    healthCheckInterval: number;
    metricsRetentionDays: number;
    alertCooldownMinutes: number;
  };
  security: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    passwordPolicy: {
      minLength: number;
      requireSpecialChars: boolean;
      requireNumbers: boolean;
    };
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

export interface FilterOptions {
  startDate?: string;
  endDate?: string;
  status?: string;
  service?: string;
  user?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  current: boolean;
  badge?: number;
  children?: NavigationItem[];
}