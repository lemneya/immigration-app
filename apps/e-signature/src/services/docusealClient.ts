import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { SignatureServiceConfig, DocuSealApiResponse } from '../types';

export interface DocuSealSubmission {
  id: string;
  status: string;
  template_id?: string;
  submitters: DocuSealSubmitter[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
  expired_at?: string;
  declined_at?: string;
  audit_trail_url?: string;
  combined_document_url?: string;
}

export interface DocuSealSubmitter {
  id: string;
  uuid: string;
  name: string;
  email: string;
  role?: string;
  status: string;
  completed_at?: string;
  declined_at?: string;
  opened_at?: string;
  sent_at?: string;
  signing_url?: string;
  embed_url?: string;
}

export interface DocuSealTemplate {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  folder_name?: string;
  external_id?: string;
  submitters: Array<{
    name: string;
    role?: string;
  }>;
  documents: Array<{
    id: string;
    url: string;
    filename: string;
  }>;
  fields: Array<{
    uuid: string;
    submitter: string;
    name: string;
    type: string;
    required: boolean;
    page: number;
    areas: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
    }>;
  }>;
}

export interface CreateSubmissionRequest {
  template_id?: string;
  send_email?: boolean;
  submitters: Array<{
    role?: string;
    name: string;
    email: string;
    fields?: Array<{
      name: string;
      default_value?: string;
    }>;
  }>;
  documents?: Array<{
    name: string;
    file: Buffer;
  }>;
  message?: string;
  subject?: string;
  expire_at?: string;
  completed_redirect_url?: string;
  metadata?: Record<string, any>;
}

export interface CreateTemplateRequest {
  name: string;
  documents: Array<{
    name: string;
    file: Buffer;
  }>;
  submitters: Array<{
    name: string;
    role?: string;
  }>;
  fields?: Array<{
    name: string;
    type: string;
    submitter: string;
    page: number;
    areas: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
    }>;
    required?: boolean;
    default_value?: string;
    options?: string[];
  }>;
  folder_name?: string;
  external_id?: string;
}

export class DocuSealClient {
  private client: AxiosInstance;
  private config: SignatureServiceConfig;

  constructor(config: SignatureServiceConfig) {
    this.config = config;
    
    this.client = axios.create({
      baseURL: config.docusealUrl,
      timeout: 30000,
      headers: {
        'X-Auth-Token': config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`DocuSeal API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('DocuSeal API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`DocuSeal API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('DocuSeal API Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get all templates
   */
  async getTemplates(): Promise<DocuSealApiResponse<DocuSealTemplate[]>> {
    try {
      const response: AxiosResponse<DocuSealTemplate[]> = await this.client.get('/api/templates');
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get a specific template
   */
  async getTemplate(templateId: string): Promise<DocuSealApiResponse<DocuSealTemplate>> {
    try {
      const response: AxiosResponse<DocuSealTemplate> = await this.client.get(`/api/templates/${templateId}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        // @ts-ignore
        data: null,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(templateData: CreateTemplateRequest): Promise<DocuSealApiResponse<DocuSealTemplate>> {
    try {
      const formData = new FormData();
      
      // Add template metadata
      formData.append('name', templateData.name);
      if (templateData.folder_name) {
        formData.append('folder_name', templateData.folder_name);
      }
      if (templateData.external_id) {
        formData.append('external_id', templateData.external_id);
      }
      
      // Add submitters
      formData.append('submitters', JSON.stringify(templateData.submitters));
      
      // Add fields if provided
      if (templateData.fields) {
        formData.append('fields', JSON.stringify(templateData.fields));
      }
      
      // Add documents
      templateData.documents.forEach((doc, index) => {
        formData.append(`documents[${index}][name]`, doc.name);
        formData.append(`documents[${index}][file]`, doc.file, doc.name);
      });

      const response: AxiosResponse<DocuSealTemplate> = await this.client.post('/api/templates', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        // @ts-ignore
        data: null,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Create a new submission from template
   */
  async createSubmission(submissionData: CreateSubmissionRequest): Promise<DocuSealApiResponse<DocuSealSubmission>> {
    try {
      let response: AxiosResponse<DocuSealSubmission>;

      if (submissionData.documents && submissionData.documents.length > 0) {
        // Create submission with documents (multipart form data)
        const formData = new FormData();
        
        if (submissionData.template_id) {
          formData.append('template_id', submissionData.template_id);
        }
        
        formData.append('send_email', String(submissionData.send_email ?? true));
        formData.append('submitters', JSON.stringify(submissionData.submitters));
        
        if (submissionData.message) {
          formData.append('message', submissionData.message);
        }
        if (submissionData.subject) {
          formData.append('subject', submissionData.subject);
        }
        if (submissionData.expire_at) {
          formData.append('expire_at', submissionData.expire_at);
        }
        if (submissionData.completed_redirect_url) {
          formData.append('completed_redirect_url', submissionData.completed_redirect_url);
        }
        if (submissionData.metadata) {
          formData.append('metadata', JSON.stringify(submissionData.metadata));
        }
        
        // Add documents
        submissionData.documents.forEach((doc, index) => {
          formData.append(`documents[${index}][name]`, doc.name);
          formData.append(`documents[${index}][file]`, doc.file, doc.name);
        });

        response = await this.client.post('/api/submissions', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        // Create submission from template (JSON)
        response = await this.client.post('/api/submissions', submissionData);
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        // @ts-ignore
        data: null,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get all submissions
   */
  async getSubmissions(limit?: number, offset?: number): Promise<DocuSealApiResponse<DocuSealSubmission[]>> {
    try {
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());
      
      const response: AxiosResponse<DocuSealSubmission[]> = await this.client.get(
        `/api/submissions${params.toString() ? '?' + params.toString() : ''}`
      );
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get a specific submission
   */
  async getSubmission(submissionId: string): Promise<DocuSealApiResponse<DocuSealSubmission>> {
    try {
      const response: AxiosResponse<DocuSealSubmission> = await this.client.get(`/api/submissions/${submissionId}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        // @ts-ignore
        data: null,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Archive a submission
   */
  async archiveSubmission(submissionId: string): Promise<DocuSealApiResponse<{ message: string }>> {
    try {
      const response: AxiosResponse<{ message: string }> = await this.client.delete(`/api/submissions/${submissionId}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        // @ts-ignore
        data: null,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Send reminder to submitter
   */
  async sendReminder(submitterId: string): Promise<DocuSealApiResponse<{ message: string }>> {
    try {
      const response: AxiosResponse<{ message: string }> = await this.client.post(`/api/submitters/${submitterId}/send_email`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        // @ts-ignore
        data: null,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get submission audit trail
   */
  async getAuditTrail(submissionId: string): Promise<DocuSealApiResponse<any>> {
    try {
      const response: AxiosResponse<any> = await this.client.get(`/api/submissions/${submissionId}/audit_trail`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        // @ts-ignore
        data: null,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Download completed document
   */
  async downloadDocument(submissionId: string): Promise<DocuSealApiResponse<Buffer>> {
    try {
      const response: AxiosResponse<Buffer> = await this.client.get(`/api/submissions/${submissionId}/download`, {
        responseType: 'arraybuffer'
      });
      
      return {
        success: true,
        data: Buffer.from(response.data)
      };
    } catch (error: any) {
      return {
        success: false,
        // @ts-ignore
        data: null,
        error: error.response?.data?.message || error.message
      };
    }
  }
}