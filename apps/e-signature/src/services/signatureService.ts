import { v4 as uuidv4 } from 'uuid';
import { addDays, format } from 'date-fns';
import { 
  SignatureRequest, 
  SignerInfo, 
  CreateSignatureRequestOptions, 
  SignatureTemplate,
  SignatureRequestSummary,
  SignatureAnalytics,
  SignatureStatus,
  SignatureServiceConfig
} from '../types';
import { DocuSealClient, DocuSealSubmission, CreateSubmissionRequest } from './docusealClient';

export class SignatureService {
  private docusealClient: DocuSealClient;
  private config: SignatureServiceConfig;
  private requests: Map<string, SignatureRequest> = new Map();
  private templates: Map<string, SignatureTemplate> = new Map();

  constructor(config: SignatureServiceConfig) {
    this.config = config;
    this.docusealClient = new DocuSealClient(config);
    this.initializeTemplates();
  }

  /**
   * Create a new signature request
   */
  async createSignatureRequest(options: CreateSignatureRequestOptions): Promise<{ success: boolean; data?: SignatureRequest; error?: string }> {
    try {
      const requestId = uuidv4();
      const now = new Date().toISOString();
      
      // Prepare signers with IDs and status
      const signers: SignerInfo[] = options.signers.map((signer, index) => ({
        ...signer,
        id: uuidv4(),
        order: signer.order ?? index + 1,
        status: 'pending' as const,
        remindersSent: 0
      }));

      // Create DocuSeal submission request
      const submissionData: CreateSubmissionRequest = {
        template_id: options.templateId,
        send_email: true,
        submitters: signers.map(signer => ({
          name: signer.name,
          email: signer.email,
          role: signer.role || 'signer',
          fields: signer.fields?.map(field => ({
            name: field.name,
            default_value: field.defaultValue
          }))
        })),
        message: options.message,
        subject: options.title,
        expire_at: options.dueDate,
        metadata: {
          ...options.metadata,
          immigration_suite_request_id: requestId
        }
      };

      // Add documents if provided
      if (options.documentBuffer && options.filename) {
        submissionData.documents = [{
          name: options.filename,
          file: options.documentBuffer
        }];
      }

      // Create submission in DocuSeal
      const docusealResponse = await this.docusealClient.createSubmission(submissionData);
      
      if (!docusealResponse.success || !docusealResponse.data) {
        return {
          success: false,
          error: `DocuSeal error: ${docusealResponse.error}`
        };
      }

      // Create internal signature request
      const signatureRequest: SignatureRequest = {
        id: requestId,
        templateId: options.templateId,
        documentUrl: options.documentUrl,
        documentBuffer: options.documentBuffer,
        signers,
        title: options.title,
        message: options.message,
        metadata: {
          ...options.metadata,
          // @ts-ignore
          docuseal_submission_id: docusealResponse.data.id
        },
        dueDate: options.dueDate,
        reminderEnabled: options.reminderEnabled ?? true,
        status: 'sent',
        createdAt: now,
        updatedAt: now
      };

      // Store the request
      this.requests.set(requestId, signatureRequest);

      return {
        success: true,
        data: signatureRequest
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to create signature request: ${error.message}`
      };
    }
  }

  /**
   * Get signature request by ID
   */
  async getSignatureRequest(requestId: string): Promise<{ success: boolean; data?: SignatureRequest; error?: string }> {
    try {
      const request = this.requests.get(requestId);
      
      if (!request) {
        return {
          success: false,
          error: 'Signature request not found'
        };
      }

      // Sync with DocuSeal to get latest status
      if (request.metadata?.docuseal_submission_id) {
        const docusealResponse = await this.docusealClient.getSubmission(request.metadata.docuseal_submission_id);
        
        if (docusealResponse.success && docusealResponse.data) {
          // @ts-ignore
          const updatedRequest = this.syncRequestWithDocuSeal(request, docusealResponse.data);
          this.requests.set(requestId, updatedRequest);
          
          return {
            success: true,
            data: updatedRequest
          };
        }
      }

      return {
        success: true,
        data: request
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get signature request: ${error.message}`
      };
    }
  }

  /**
   * Get all signature requests with optional filtering
   */
  async getSignatureRequests(
    status?: SignatureStatus,
    limit?: number,
    offset?: number
  ): Promise<{ success: boolean; data?: SignatureRequestSummary[]; error?: string }> {
    try {
      let requests = Array.from(this.requests.values());
      
      // Filter by status if provided
      if (status) {
        requests = requests.filter(req => req.status === status);
      }

      // Apply pagination
      if (offset) {
        requests = requests.slice(offset);
      }
      if (limit) {
        requests = requests.slice(0, limit);
      }

      // Convert to summary format
      const summaries: SignatureRequestSummary[] = requests.map(req => ({
        id: req.id,
        title: req.title,
        status: req.status,
        signers: {
          total: req.signers.length,
          pending: req.signers.filter(s => s.status === 'pending').length,
          signed: req.signers.filter(s => s.status === 'signed').length,
          declined: req.signers.filter(s => s.status === 'declined').length
        },
        createdAt: req.createdAt,
        dueDate: req.dueDate,
        completedAt: req.completedAt
      }));

      return {
        success: true,
        data: summaries
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get signature requests: ${error.message}`
      };
    }
  }

  /**
   * Cancel a signature request
   */
  async cancelSignatureRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const request = this.requests.get(requestId);
      
      if (!request) {
        return {
          success: false,
          error: 'Signature request not found'
        };
      }

      if (request.status === 'completed' || request.status === 'cancelled') {
        return {
          success: false,
          error: 'Cannot cancel completed or already cancelled request'
        };
      }

      // Archive in DocuSeal
      if (request.metadata?.docuseal_submission_id) {
        await this.docusealClient.archiveSubmission(request.metadata.docuseal_submission_id);
      }

      // Update local status
      request.status = 'cancelled';
      request.updatedAt = new Date().toISOString();
      this.requests.set(requestId, request);

      return {
        success: true
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to cancel signature request: ${error.message}`
      };
    }
  }

  /**
   * Send reminder to a specific signer
   */
  async sendReminder(requestId: string, signerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const request = this.requests.get(requestId);
      
      if (!request) {
        return {
          success: false,
          error: 'Signature request not found'
        };
      }

      const signer = request.signers.find(s => s.id === signerId);
      
      if (!signer) {
        return {
          success: false,
          error: 'Signer not found'
        };
      }

      if (signer.status === 'signed' || signer.status === 'declined') {
        return {
          success: false,
          error: 'Cannot send reminder to signer who has already responded'
        };
      }

      // Find DocuSeal submitter ID (this would need to be stored during creation)
      const docusealSubmitterId = signer.id; // In a real implementation, you'd map this properly

      // Send reminder via DocuSeal
      const reminderResponse = await this.docusealClient.sendReminder(docusealSubmitterId);
      
      if (!reminderResponse.success) {
        return {
          success: false,
          error: `Failed to send reminder: ${reminderResponse.error}`
        };
      }

      // Update reminder count
      signer.remindersSent = (signer.remindersSent || 0) + 1;
      request.updatedAt = new Date().toISOString();
      this.requests.set(requestId, request);

      return {
        success: true
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to send reminder: ${error.message}`
      };
    }
  }

  /**
   * Download signed document
   */
  async downloadDocument(requestId: string): Promise<{ success: boolean; data?: Buffer; error?: string }> {
    try {
      const request = this.requests.get(requestId);
      
      if (!request) {
        return {
          success: false,
          error: 'Signature request not found'
        };
      }

      if (request.status !== 'completed') {
        return {
          success: false,
          error: 'Document not yet completed'
        };
      }

      // Download from DocuSeal
      if (request.metadata?.docuseal_submission_id) {
        const downloadResponse = await this.docusealClient.downloadDocument(request.metadata.docuseal_submission_id);
        
        if (downloadResponse.success && downloadResponse.data) {
          return {
            success: true,
            // @ts-ignore
            data: downloadResponse.data
          };
        } else {
          return {
            success: false,
            error: `Failed to download: ${downloadResponse.error}`
          };
        }
      }

      return {
        success: false,
        error: 'No DocuSeal submission ID found'
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to download document: ${error.message}`
      };
    }
  }

  /**
   * Get signature analytics
   */
  async getAnalytics(): Promise<{ success: boolean; data?: SignatureAnalytics; error?: string }> {
    try {
      const requests = Array.from(this.requests.values());
      const now = new Date();
      
      const analytics: SignatureAnalytics = {
        totalRequests: requests.length,
        completedRequests: requests.filter(r => r.status === 'completed').length,
        pendingRequests: requests.filter(r => ['sent', 'viewed'].includes(r.status)).length,
        averageCompletionTime: 0,
        completionRate: 0,
        declineRate: 0,
        statusBreakdown: {
          draft: 0,
          sent: 0,
          viewed: 0,
          signed: 0,
          completed: 0,
          expired: 0,
          cancelled: 0,
          declined: 0
        },
        monthlyTrends: []
      };

      // Calculate rates
      if (requests.length > 0) {
        analytics.completionRate = (analytics.completedRequests / requests.length) * 100;
        analytics.declineRate = (requests.filter(r => r.status === 'declined').length / requests.length) * 100;
      }

      // Status breakdown
      requests.forEach(request => {
        analytics.statusBreakdown[request.status]++;
      });

      // Calculate average completion time
      const completedRequests = requests.filter(r => r.status === 'completed' && r.completedAt);
      if (completedRequests.length > 0) {
        const totalTime = completedRequests.reduce((sum, req) => {
          const created = new Date(req.createdAt);
          const completed = new Date(req.completedAt!);
          return sum + (completed.getTime() - created.getTime());
        }, 0);
        analytics.averageCompletionTime = Math.round(totalTime / completedRequests.length / (1000 * 60 * 60 * 24)); // Days
      }

      // Monthly trends (last 12 months)
      for (let i = 11; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = month.getTime();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0).getTime();
        
        const monthRequests = requests.filter(r => {
          const created = new Date(r.createdAt).getTime();
          return created >= monthStart && created <= monthEnd;
        });
        
        analytics.monthlyTrends.push({
          month: format(month, 'yyyy-MM'),
          requests: monthRequests.length,
          completed: monthRequests.filter(r => r.status === 'completed').length
        });
      }

      return {
        success: true,
        data: analytics
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get analytics: ${error.message}`
      };
    }
  }

  /**
   * Handle DocuSeal webhook
   */
  async handleWebhook(payload: any): Promise<{ success: boolean; error?: string }> {
    try {
      const { event_type, data } = payload;
      const submissionId = data.submission_id;
      
      // Find the request by DocuSeal submission ID
      const request = Array.from(this.requests.values())
        .find(r => r.metadata?.docuseal_submission_id === submissionId);
      
      if (!request) {
        console.log('No matching request found for submission:', submissionId);
        return { success: true }; // Not an error, just no matching request
      }

      // Update request based on webhook event
      switch (event_type) {
        case 'submission.completed':
          request.status = 'completed';
          request.completedAt = new Date().toISOString();
          break;
        case 'submission.declined':
          request.status = 'declined';
          break;
        case 'submission.expired':
          request.status = 'expired';
          break;
        case 'submitter.signed':
          if (data.submitter) {
            const signer = request.signers.find(s => s.email === data.submitter.email);
            if (signer) {
              signer.status = 'signed';
              signer.signedAt = data.submitter.completed_at || new Date().toISOString();
            }
          }
          break;
        case 'submitter.viewed':
          if (data.submitter) {
            const signer = request.signers.find(s => s.email === data.submitter.email);
            if (signer) {
              signer.status = 'viewed';
              signer.viewedAt = new Date().toISOString();
            }
          }
          // Update overall status if this was the first view
          if (request.status === 'sent') {
            request.status = 'viewed';
          }
          break;
      }

      request.updatedAt = new Date().toISOString();
      this.requests.set(request.id, request);

      return { success: true };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to handle webhook: ${error.message}`
      };
    }
  }

  /**
   * Sync request with DocuSeal data
   */
  private syncRequestWithDocuSeal(request: SignatureRequest, docusealData: DocuSealSubmission): SignatureRequest {
    const updated = { ...request };
    
    // Update overall status
    switch (docusealData.status) {
      case 'completed':
        updated.status = 'completed';
        updated.completedAt = docusealData.completed_at;
        break;
      case 'declined':
        updated.status = 'declined';
        break;
      case 'expired':
        updated.status = 'expired';
        break;
      case 'pending':
        // Check if any submitter has viewed
        const hasViewed = docusealData.submitters.some(s => s.opened_at);
        updated.status = hasViewed ? 'viewed' : 'sent';
        break;
    }

    // Update signer statuses
    updated.signers = updated.signers.map(signer => {
      const docusealSubmitter = docusealData.submitters.find(s => s.email === signer.email);
      
      if (docusealSubmitter) {
        return {
          ...signer,
          status: this.mapDocuSealStatus(docusealSubmitter.status),
          signedAt: docusealSubmitter.completed_at,
          viewedAt: docusealSubmitter.opened_at
        };
      }
      
      return signer;
    });

    updated.updatedAt = new Date().toISOString();
    
    return updated;
  }

  /**
   * Map DocuSeal submitter status to our signer status
   */
  private mapDocuSealStatus(docusealStatus: string) {
    switch (docusealStatus) {
      case 'completed':
        return 'signed' as const;
      case 'declined':
        return 'declined' as const;
      case 'expired':
        return 'expired' as const;
      case 'pending':
        return 'sent' as const;
      default:
        return 'pending' as const;
    }
  }

  /**
   * Initialize default templates
   */
  private async initializeTemplates(): Promise<void> {
    // This would typically load templates from a database
    // For now, we'll just log that templates are being initialized
    console.log('🖊️  Initializing signature templates...');
    
    // In a real implementation, you'd create default templates for common immigration forms
    // Example template configurations would be loaded here
  }
}