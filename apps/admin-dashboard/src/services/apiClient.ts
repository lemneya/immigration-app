import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse, ServiceHealth, SystemMetrics, ServiceMetrics } from '@/types';

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL?: string) {
    this.client = axios.create({
      baseURL: baseURL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3008',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('API Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  // Generic request method
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.request({
        method,
        url,
        data,
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error occurred',
      };
    }
  }

  // Health check methods
  async getSystemHealth(): Promise<ApiResponse<ServiceHealth[]>> {
    const services = [
      { name: 'OCR Service', url: process.env.NEXT_PUBLIC_OCR_SERVICE_URL + '/health' },
      { name: 'PDF Service', url: process.env.NEXT_PUBLIC_PDF_SERVICE_URL + '/health' },
      { name: 'E-Signature Service', url: process.env.NEXT_PUBLIC_SIGNATURE_SERVICE_URL + '/health' },
      { name: 'Case Status Service', url: process.env.NEXT_PUBLIC_CASE_STATUS_SERVICE_URL + '/health' },
    ];

    const healthChecks = await Promise.allSettled(
      services.map(async (service) => {
        const startTime = Date.now();
        try {
          const response = await axios.get(service.url, { timeout: 5000 });
          const responseTime = Date.now() - startTime;
          
          return {
            name: service.name,
            url: service.url,
            status: 'healthy' as const,
            responseTime,
            lastChecked: new Date().toISOString(),
            version: response.data.version,
            uptime: response.data.uptime,
          };
        } catch (error: any) {
          return {
            name: service.name,
            url: service.url,
            status: 'unhealthy' as const,
            responseTime: Date.now() - startTime,
            lastChecked: new Date().toISOString(),
            error: error.message,
          };
        }
      })
    );

    const results = healthChecks.map((result) =>
      result.status === 'fulfilled' ? result.value : {
        name: 'Unknown Service',
        url: '',
        status: 'unknown' as const,
        lastChecked: new Date().toISOString(),
        error: 'Health check failed',
      }
    );

    return {
      success: true,
      data: results,
    };
  }

  async getServiceHealth(serviceName: string): Promise<ApiResponse<ServiceHealth>> {
    const serviceUrls = {
      'ocr': process.env.NEXT_PUBLIC_OCR_SERVICE_URL,
      'pdf-fill': process.env.NEXT_PUBLIC_PDF_SERVICE_URL,
      'e-signature': process.env.NEXT_PUBLIC_SIGNATURE_SERVICE_URL,
      'case-status': process.env.NEXT_PUBLIC_CASE_STATUS_SERVICE_URL,
    };

    const baseUrl = serviceUrls[serviceName as keyof typeof serviceUrls];
    if (!baseUrl) {
      return {
        success: false,
        error: `Unknown service: ${serviceName}`,
      };
    }

    const startTime = Date.now();
    try {
      const response = await axios.get(`${baseUrl}/health`, { timeout: 5000 });
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          name: serviceName,
          url: `${baseUrl}/health`,
          status: 'healthy',
          responseTime,
          lastChecked: new Date().toISOString(),
          version: response.data.version,
          uptime: response.data.uptime,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        data: {
          name: serviceName,
          url: `${baseUrl}/health`,
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          lastChecked: new Date().toISOString(),
          error: error.message,
        },
      };
    }
  }

  // System metrics
  async getSystemMetrics(): Promise<ApiResponse<SystemMetrics>> {
    // This would typically aggregate metrics from all services
    // For now, return mock data
    return {
      success: true,
      data: {
        totalRequests: 15420,
        totalUsers: 342,
        activeServices: 4,
        totalStorage: '2.4 GB',
        averageResponseTime: 245,
        errorRate: 0.02,
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  async getServiceMetrics(serviceName: string): Promise<ApiResponse<ServiceMetrics>> {
    // Mock service metrics - in production, this would fetch from monitoring systems
    return {
      success: true,
      data: {
        serviceName,
        requestCount: Math.floor(Math.random() * 10000) + 1000,
        errorCount: Math.floor(Math.random() * 100) + 10,
        averageResponseTime: Math.floor(Math.random() * 500) + 100,
        uptime: 99.5 + Math.random() * 0.5,
        throughput: Math.floor(Math.random() * 1000) + 100,
      },
    };
  }

  // Case status service methods
  async getCaseStatusAnalytics(): Promise<ApiResponse<any>> {
    return this.request('GET', '/api/case-status/analytics');
  }

  async getTrackedCases(): Promise<ApiResponse<any[]>> {
    return this.request('GET', '/api/case-status/tracking');
  }

  async getCaseAlerts(receiptNumber?: string): Promise<ApiResponse<any[]>> {
    const url = receiptNumber ? `/api/case-status/alerts/${receiptNumber}` : '/api/case-status/alerts';
    return this.request('GET', url);
  }

  // E-signature service methods
  async getSignatureRequests(): Promise<ApiResponse<any[]>> {
    return this.request('GET', '/api/e-signature/requests');
  }

  async getSignatureAnalytics(): Promise<ApiResponse<any>> {
    return this.request('GET', '/api/e-signature/analytics');
  }

  async getSignatureTemplates(): Promise<ApiResponse<any[]>> {
    return this.request('GET', '/api/e-signature/templates');
  }

  // OCR service methods
  async getOcrJobs(): Promise<ApiResponse<any[]>> {
    return this.request('GET', '/api/ocr/jobs');
  }

  async getOcrAnalytics(): Promise<ApiResponse<any>> {
    return this.request('GET', '/api/ocr/analytics');
  }

  // PDF service methods
  async getPdfJobs(): Promise<ApiResponse<any[]>> {
    return this.request('GET', '/api/pdf-fill/jobs');
  }

  async getPdfAnalytics(): Promise<ApiResponse<any>> {
    return this.request('GET', '/api/pdf-fill/analytics');
  }

  // User management methods (mock for now)
  async getUsers(): Promise<ApiResponse<any[]>> {
    // Mock user data
    return {
      success: true,
      data: [
        {
          id: '1',
          email: 'admin@immigration.gov',
          name: 'System Administrator',
          role: 'admin',
          status: 'active',
          lastLogin: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
          permissions: ['read', 'write', 'admin'],
        },
        {
          id: '2',
          email: 'operator@immigration.gov',
          name: 'Case Operator',
          role: 'operator',
          status: 'active',
          lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
          permissions: ['read', 'write'],
        },
      ],
    };
  }

  // Activity logs
  async getActivityLogs(filters?: any): Promise<ApiResponse<any[]>> {
    // Mock activity logs
    return {
      success: true,
      data: [
        {
          id: '1',
          userId: '1',
          userName: 'System Administrator',
          action: 'login',
          resource: 'admin-dashboard',
          details: { ip: '192.168.1.100' },
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          status: 'success',
        },
        {
          id: '2',
          userId: '2',
          userName: 'Case Operator',
          action: 'view_case_status',
          resource: 'MSC2190000001',
          details: { receiptNumber: 'MSC2190000001' },
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          ipAddress: '192.168.1.101',
          userAgent: 'Mozilla/5.0',
          status: 'success',
        },
      ],
    };
  }
}

// Export singleton instance
export const apiClient = new ApiClient();