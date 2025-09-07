/**
 * Integration Service - One-Click Actions
 * Connects mail processing results to existing immigration suite services
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import type { ExtractedInfo, DocumentType } from '../models/types';

interface ServiceURLs {
  caseStatus: string;
  voiceTranslation: string;
  uscisTracker: string;
  reminderService?: string;
  paymentService?: string;
}

export interface ActionHook {
  id: string;
  type: 'case_tracker' | 'voice_call' | 'reminder' | 'payment' | 'external';
  title: string;
  description: string;
  icon: string;
  url?: string;
  payload?: any;
  enabled: boolean;
}

export class IntegrationService {
  private serviceUrls: ServiceURLs;

  constructor() {
    this.serviceUrls = {
      caseStatus: process.env.CASE_STATUS_SERVICE_URL || 'http://localhost:3004',
      voiceTranslation: process.env.VOICE_TRANSLATION_SERVICE_URL || 'http://localhost:3009',
      uscisTracker: process.env.CASE_STATUS_SERVICE_URL || 'http://localhost:3004',
      reminderService: process.env.REMINDER_SERVICE_URL,
      paymentService: process.env.PAYMENT_SERVICE_URL,
    };
  }

  /**
   * Generate one-click action hooks based on extracted information
   */
  async generateActionHooks(
    extractedInfo: ExtractedInfo,
    docType: DocumentType,
    jobId: string
  ): Promise<ActionHook[]> {
    const hooks: ActionHook[] = [];

    try {
      // USCIS Case Tracking Integration
      if (extractedInfo.receipts && extractedInfo.receipts.length > 0) {
        for (const receipt of extractedInfo.receipts) {
          hooks.push({
            id: `track_case_${receipt}`,
            type: 'case_tracker',
            title: 'Track USCIS Case Status',
            description: `Check status updates for case ${receipt}`,
            icon: '🔍',
            payload: {
              receiptNumber: receipt,
              service: 'case-status',
              action: 'track'
            },
            enabled: true
          });
        }
      }

      // Voice Translation Integration (for multilingual support)
      if (docType === 'uscis_notice' && extractedInfo.people && extractedInfo.people.length > 0) {
        hooks.push({
          id: `voice_explain_${jobId}`,
          type: 'voice_call',
          title: 'Get Voice Explanation',
          description: 'Call for a voice explanation of this document in your language',
          icon: '📞',
          payload: {
            documentType: docType,
            language: 'auto-detect',
            content: 'document_summary',
            jobId
          },
          enabled: true
        });
      }

      // Renewal Reminder Setup
      const expirationDate = extractedInfo.dates?.find(d => d.type === 'expiration' && d.critical);
      if (expirationDate) {
        const expDate = new Date(expirationDate.date);
        const reminderDate = new Date(expDate);
        reminderDate.setDate(reminderDate.getDate() - 180); // 180 days before

        hooks.push({
          id: `reminder_renewal_${jobId}`,
          type: 'reminder',
          title: 'Set Renewal Reminder',
          description: `Get reminded to file renewal 180 days before expiration (${reminderDate.toDateString()})`,
          icon: '⏰',
          payload: {
            reminderDate: reminderDate.toISOString(),
            expirationDate: expDate.toISOString(),
            documentType: docType,
            action: 'renewal_filing',
            jobId
          },
          enabled: true
        });
      }

      // Payment Integration (for application fees)
      const renewalAction = extractedInfo.actions?.find(a => 
        a.action.toLowerCase().includes('renewal') || a.action.toLowerCase().includes('file')
      );
      if (renewalAction && docType === 'uscis_notice') {
        hooks.push({
          id: `pay_renewal_fee_${jobId}`,
          type: 'payment',
          title: 'Pay Application Fee',
          description: 'Calculate and pay USCIS filing fee for renewal application',
          icon: '💳',
          payload: {
            formType: 'I-765', // Based on document type
            feeCategory: 'renewal',
            estimatedAmount: 410, // Current I-765 renewal fee
            jobId
          },
          enabled: !!this.serviceUrls.paymentService
        });
      }

      // External USCIS Website Links
      if (docType === 'uscis_notice') {
        hooks.push({
          id: `uscis_website_${docType}`,
          type: 'external',
          title: 'Visit USCIS Website',
          description: 'Get official information and forms from USCIS',
          icon: '🌐',
          url: 'https://www.uscis.gov/i-765',
          enabled: true
        });
      }

      // Legal Consultation (if high risk)
      hooks.push({
        id: `legal_consult_${jobId}`,
        type: 'external',
        title: 'Schedule Legal Consultation',
        description: 'Connect with immigration attorneys for personalized advice',
        icon: '⚖️',
        url: 'tel:+1-800-IMMIGRATION', // Placeholder
        enabled: true
      });

      logger.info(`Generated ${hooks.length} action hooks for job ${jobId}`);
      return hooks.filter(hook => hook.enabled);

    } catch (error) {
      logger.error('Failed to generate action hooks:', error);
      return [];
    }
  }

  /**
   * Execute a one-click action
   */
  async executeAction(hookId: string, payload: any, userId?: string): Promise<any> {
    try {
      logger.info(`Executing action hook: ${hookId}`, { payload, userId });

      // Parse hook ID to determine action type
      const [actionType] = hookId.split('_');

      switch (actionType) {
        case 'track':
          return await this.executeUSCISTracking(payload);
        
        case 'voice':
          return await this.initiateVoiceCall(payload);
        
        case 'reminder':
          return await this.setReminder(payload, userId);
        
        case 'pay':
          return await this.processPayment(payload, userId);
        
        default:
          logger.warn(`Unknown action type: ${actionType}`);
          return { success: false, error: 'Unknown action type' };
      }

    } catch (error) {
      logger.error(`Failed to execute action ${hookId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Track USCIS case status
   */
  private async executeUSCISTracking(payload: { receiptNumber: string }): Promise<any> {
    try {
      const response = await axios.post(`${this.serviceUrls.caseStatus}/api/case/track`, {
        receiptNumber: payload.receiptNumber,
        source: 'mail_processor'
      }, {
        timeout: 10000
      });

      return {
        success: true,
        data: response.data,
        message: `Successfully initiated tracking for case ${payload.receiptNumber}`
      };

    } catch (error) {
      logger.error('USCIS tracking failed:', error);
      return {
        success: false,
        error: 'Unable to initiate case tracking',
        details: error.response?.data?.message
      };
    }
  }

  /**
   * Initiate voice call for document explanation
   */
  private async initiateVoiceCall(payload: { documentType: string; language: string; content: string; jobId: string }): Promise<any> {
    try {
      const response = await axios.post(`${this.serviceUrls.voiceTranslation}/api/voice/explain`, {
        documentType: payload.documentType,
        preferredLanguage: payload.language,
        contentType: payload.content,
        jobId: payload.jobId,
        source: 'mail_processor'
      }, {
        timeout: 15000
      });

      return {
        success: true,
        data: response.data,
        message: 'Voice explanation session initiated'
      };

    } catch (error) {
      logger.error('Voice call initiation failed:', error);
      return {
        success: false,
        error: 'Unable to initiate voice explanation',
        details: error.response?.data?.message
      };
    }
  }

  /**
   * Set document renewal reminder
   */
  private async setReminder(payload: { reminderDate: string; expirationDate: string; documentType: string; action: string; jobId: string }, userId?: string): Promise<any> {
    try {
      // If no dedicated reminder service, use a simple approach
      if (!this.serviceUrls.reminderService) {
        // Store reminder in database or use notification system
        logger.info('Reminder set (mock implementation):', payload);
        return {
          success: true,
          message: `Reminder set for ${new Date(payload.reminderDate).toLocaleDateString()}`,
          reminderDate: payload.reminderDate,
          mockImplementation: true
        };
      }

      const response = await axios.post(`${this.serviceUrls.reminderService}/api/reminders`, {
        userId,
        title: `${payload.documentType} Renewal Due`,
        description: `Your ${payload.documentType} expires on ${new Date(payload.expirationDate).toLocaleDateString()}. File renewal application now.`,
        reminderDate: payload.reminderDate,
        category: 'document_renewal',
        priority: 'high',
        metadata: {
          jobId: payload.jobId,
          documentType: payload.documentType,
          expirationDate: payload.expirationDate
        }
      });

      return {
        success: true,
        data: response.data,
        message: 'Renewal reminder successfully set'
      };

    } catch (error) {
      logger.error('Reminder setup failed:', error);
      return {
        success: false,
        error: 'Unable to set reminder',
        details: error.response?.data?.message
      };
    }
  }

  /**
   * Process payment for application fees
   */
  private async processPayment(payload: { formType: string; feeCategory: string; estimatedAmount: number; jobId: string }, userId?: string): Promise<any> {
    try {
      if (!this.serviceUrls.paymentService) {
        // Mock implementation - redirect to USCIS fee payment
        return {
          success: true,
          redirectUrl: 'https://www.pay.gov/public/form/start/55921268',
          message: `USCIS ${payload.formType} ${payload.feeCategory} fee: $${payload.estimatedAmount}`,
          mockImplementation: true
        };
      }

      const response = await axios.post(`${this.serviceUrls.paymentService}/api/payments/calculate`, {
        userId,
        formType: payload.formType,
        category: payload.feeCategory,
        metadata: {
          jobId: payload.jobId,
          source: 'mail_processor'
        }
      });

      return {
        success: true,
        data: response.data,
        message: 'Payment calculation completed'
      };

    } catch (error) {
      logger.error('Payment processing failed:', error);
      return {
        success: false,
        error: 'Unable to process payment',
        details: error.response?.data?.message
      };
    }
  }

  /**
   * Get available actions for a specific document
   */
  async getAvailableActions(docType: DocumentType): Promise<string[]> {
    const actionMap: Record<DocumentType, string[]> = {
      uscis_notice: ['case_tracker', 'voice_call', 'reminder', 'payment', 'external'],
      insurance_doc: ['voice_call', 'external'],
      bank_statement: ['voice_call'],
      tax_document: ['voice_call', 'external'],
      employment_doc: ['voice_call'],
      medical_record: ['voice_call', 'external'],
      legal_document: ['voice_call', 'external'],
      unknown: ['voice_call']
    };

    return actionMap[docType] || ['voice_call'];
  }

  /**
   * Health check for integration services
   */
  async checkServiceHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    const services = [
      { name: 'case_status', url: this.serviceUrls.caseStatus },
      { name: 'voice_translation', url: this.serviceUrls.voiceTranslation }
    ];

    await Promise.all(services.map(async (service) => {
      try {
        await axios.get(`${service.url}/health`, { timeout: 5000 });
        health[service.name] = true;
      } catch {
        health[service.name] = false;
      }
    }));

    return health;
  }
}