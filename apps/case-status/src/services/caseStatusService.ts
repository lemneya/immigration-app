import { v4 as uuidv4 } from 'uuid';
import { addDays, format } from 'date-fns';
import * as cron from 'node-cron';
import { 
  CaseStatus, 
  CaseStatusHistory, 
  CaseTrackingConfig, 
  CaseStatusAlert, 
  CaseStatusAnalytics,
  StatusHistoryEntry,
  AlertType,
  NotificationChannel,
  CaseStatusServiceConfig,
  USCISApiResponse
} from '../types';
import { USCISClient } from './uscisClient';
import { NotificationService } from './notificationService';

export class CaseStatusService {
  private uscisClient: USCISClient;
  private notificationService: NotificationService;
  private config: CaseStatusServiceConfig;
  private trackingConfigs: Map<string, CaseTrackingConfig> = new Map();
  private caseStatusCache: Map<string, CaseStatus> = new Map();
  private statusHistories: Map<string, CaseStatusHistory> = new Map();
  private alerts: Map<string, CaseStatusAlert> = new Map();

  constructor(config: CaseStatusServiceConfig) {
    this.config = config;
    this.uscisClient = new USCISClient(config);
    this.notificationService = new NotificationService(config.notificationConfig);
    
    this.initializeScheduledChecks();
  }

  /**
   * Get case status by receipt number
   */
  async getCaseStatus(receiptNumber: string, forceRefresh: boolean = false): Promise<USCISApiResponse<CaseStatus>> {
    try {
      // Check cache first unless force refresh
      if (!forceRefresh && this.caseStatusCache.has(receiptNumber)) {
        const cachedStatus = this.caseStatusCache.get(receiptNumber)!;
        const cacheAge = Date.now() - new Date(cachedStatus.lastUpdated).getTime();
        const maxCacheAge = 30 * 60 * 1000; // 30 minutes

        if (cacheAge < maxCacheAge) {
          console.log(`📋 Returning cached status for ${receiptNumber}`);
          return {
            success: true,
            data: cachedStatus,
            lastChecked: cachedStatus.lastUpdated
          };
        }
      }

      // Fetch fresh status from USCIS
      const result = await this.uscisClient.getCaseStatus(receiptNumber);
      
      if (result.success && result.data) {
        // Update cache
        this.caseStatusCache.set(receiptNumber, result.data);
        
        // Check for status changes and generate alerts
        await this.processStatusChange(result.data);
        
        // Update tracking config if exists
        const trackingConfig = this.trackingConfigs.get(receiptNumber);
        if (trackingConfig) {
          trackingConfig.lastChecked = new Date().toISOString();
          trackingConfig.totalChecks++;
          this.trackingConfigs.set(receiptNumber, trackingConfig);
        }
      }

      return result;

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get case status: ${error.message}`
      };
    }
  }

  /**
   * Get case status for multiple receipt numbers
   */
  async getBulkCaseStatus(receiptNumbers: string[], forceRefresh: boolean = false): Promise<USCISApiResponse<CaseStatus[]>> {
    try {
      const results: CaseStatus[] = [];
      const errors: string[] = [];

      console.log(`🔍 Getting bulk status for ${receiptNumbers.length} cases`);

      // Process each receipt number
      for (const receiptNumber of receiptNumbers) {
        const result = await this.getCaseStatus(receiptNumber, forceRefresh);
        
        if (result.success && result.data) {
          results.push(result.data);
        } else {
          errors.push(`${receiptNumber}: ${result.error}`);
        }

        // Add delay between requests to avoid overwhelming USCIS
        await this.delay(this.config.rateLimitDelay || 2000);
      }

      return {
        success: errors.length === 0,
        data: results,
        error: errors.length > 0 ? `Some requests failed: ${errors.join('; ')}` : undefined,
        lastChecked: new Date().toISOString()
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get bulk case status: ${error.message}`
      };
    }
  }

  /**
   * Start tracking a case
   */
  async startTracking(
    receiptNumber: string, 
    userId?: string, 
    email?: string, 
    phone?: string,
    customInterval?: number
  ): Promise<{ success: boolean; data?: CaseTrackingConfig; error?: string }> {
    try {
      // Validate receipt number by getting initial status
      const statusResult = await this.getCaseStatus(receiptNumber, true);
      if (!statusResult.success) {
        return {
          success: false,
          error: `Cannot track invalid receipt number: ${statusResult.error}`
        };
      }

      const trackingConfig: CaseTrackingConfig = {
        receiptNumber,
        userId,
        email,
        phone,
        notificationPreferences: {
          email: !!email,
          sms: !!phone,
          statusChanges: true,
          actionRequired: true,
          deadlineReminders: true,
          interviewScheduled: true,
          cardProduced: true,
          caseApproved: true,
          caseRejected: true,
          biometricsScheduled: true
        },
        trackingEnabled: true,
        checkInterval: customInterval || this.config.defaultCheckInterval || 60, // minutes
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalChecks: 1
      };

      this.trackingConfigs.set(receiptNumber, trackingConfig);

      console.log(`✅ Started tracking case ${receiptNumber}`);

      return {
        success: true,
        data: trackingConfig
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to start tracking: ${error.message}`
      };
    }
  }

  /**
   * Stop tracking a case
   */
  stopTracking(receiptNumber: string): { success: boolean; error?: string } {
    try {
      const exists = this.trackingConfigs.has(receiptNumber);
      if (!exists) {
        return {
          success: false,
          error: 'Case is not being tracked'
        };
      }

      this.trackingConfigs.delete(receiptNumber);
      console.log(`🛑 Stopped tracking case ${receiptNumber}`);

      return { success: true };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to stop tracking: ${error.message}`
      };
    }
  }

  /**
   * Get tracking configuration
   */
  getTrackingConfig(receiptNumber: string): { success: boolean; data?: CaseTrackingConfig; error?: string } {
    const config = this.trackingConfigs.get(receiptNumber);
    
    if (!config) {
      return {
        success: false,
        error: 'Case is not being tracked'
      };
    }

    return {
      success: true,
      data: config
    };
  }

  /**
   * Update tracking configuration
   */
  updateTrackingConfig(
    receiptNumber: string, 
    updates: Partial<CaseTrackingConfig>
  ): { success: boolean; data?: CaseTrackingConfig; error?: string } {
    try {
      const config = this.trackingConfigs.get(receiptNumber);
      
      if (!config) {
        return {
          success: false,
          error: 'Case is not being tracked'
        };
      }

      const updatedConfig = {
        ...config,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      this.trackingConfigs.set(receiptNumber, updatedConfig);

      return {
        success: true,
        data: updatedConfig
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to update tracking config: ${error.message}`
      };
    }
  }

  /**
   * Get case status history
   */
  getCaseHistory(receiptNumber: string): { success: boolean; data?: CaseStatusHistory; error?: string } {
    const history = this.statusHistories.get(receiptNumber);
    
    if (!history) {
      return {
        success: false,
        error: 'No status history found for this case'
      };
    }

    return {
      success: true,
      data: history
    };
  }

  /**
   * Get all tracked cases
   */
  getTrackedCases(): { success: boolean; data?: CaseTrackingConfig[]; error?: string } {
    try {
      const trackedCases = Array.from(this.trackingConfigs.values())
        .filter(config => config.trackingEnabled);

      return {
        success: true,
        data: trackedCases
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get tracked cases: ${error.message}`
      };
    }
  }

  /**
   * Get alerts for a case
   */
  getCaseAlerts(receiptNumber: string): { success: boolean; data?: CaseStatusAlert[]; error?: string } {
    try {
      const alerts = Array.from(this.alerts.values())
        .filter(alert => alert.receiptNumber === receiptNumber)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        success: true,
        data: alerts
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get case alerts: ${error.message}`
      };
    }
  }

  /**
   * Get analytics and statistics
   */
  getAnalytics(): { success: boolean; data?: CaseStatusAnalytics; error?: string } {
    try {
      const trackedCases = Array.from(this.trackingConfigs.values());
      const allStatuses = Array.from(this.caseStatusCache.values());
      const allAlerts = Array.from(this.alerts.values());

      const analytics: CaseStatusAnalytics = {
        totalCases: trackedCases.length,
        activeCases: trackedCases.filter(c => c.trackingEnabled).length,
        completedCases: allStatuses.filter(s => 
          s.currentStatus.toLowerCase().includes('approved') || 
          s.currentStatus.toLowerCase().includes('card produced')
        ).length,
        averageProcessingTime: this.calculateAverageProcessingTime(allStatuses),
        statusDistribution: this.calculateStatusDistribution(allStatuses),
        formTypeDistribution: this.calculateFormTypeDistribution(allStatuses),
        serviceCenterDistribution: this.calculateServiceCenterDistribution(allStatuses),
        monthlyTrends: this.calculateMonthlyTrends(trackedCases),
        alertStats: {
          totalAlerts: allAlerts.length,
          alertsByType: this.calculateAlertsByType(allAlerts),
          deliveryRate: this.calculateDeliveryRate(allAlerts),
          averageResponseTime: 0 // Would calculate based on actual response tracking
        }
      };

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
   * Process status change and generate alerts if necessary
   */
  private async processStatusChange(newStatus: CaseStatus): Promise<void> {
    const receiptNumber = newStatus.receiptNumber;
    const previousStatus = this.caseStatusCache.get(receiptNumber);

    // Update status history
    let history = this.statusHistories.get(receiptNumber);
    if (!history) {
      history = {
        receiptNumber,
        statusHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    // Check if status actually changed
    if (previousStatus && previousStatus.currentStatus !== newStatus.currentStatus) {
      const historyEntry: StatusHistoryEntry = {
        id: uuidv4(),
        status: newStatus.currentStatus,
        statusDate: newStatus.statusDate,
        description: newStatus.statusDescription,
        recordedAt: new Date().toISOString(),
        changes: this.identifyChanges(previousStatus, newStatus)
      };

      history.statusHistory.unshift(historyEntry);
      history.updatedAt = new Date().toISOString();
      this.statusHistories.set(receiptNumber, history);

      // Generate alerts for status change
      await this.generateStatusChangeAlert(newStatus, previousStatus);

      console.log(`📱 Status changed for ${receiptNumber}: ${previousStatus.currentStatus} → ${newStatus.currentStatus}`);
    }
  }

  /**
   * Generate alert for status change
   */
  private async generateStatusChangeAlert(newStatus: CaseStatus, previousStatus: CaseStatus): Promise<void> {
    const trackingConfig = this.trackingConfigs.get(newStatus.receiptNumber);
    
    if (!trackingConfig || !trackingConfig.trackingEnabled) {
      return;
    }

    const alertType = this.determineAlertType(newStatus);
    const priority = this.determinePriority(alertType);

    const alert: CaseStatusAlert = {
      id: uuidv4(),
      receiptNumber: newStatus.receiptNumber,
      alertType,
      title: `Case Status Update - ${newStatus.receiptNumber}`,
      message: `Your case status has changed from "${previousStatus.currentStatus}" to "${newStatus.currentStatus}". ${newStatus.statusDescription}`,
      priority,
      createdAt: new Date().toISOString(),
      channels: this.determineNotificationChannels(trackingConfig, alertType),
      metadata: {
        previousStatus: previousStatus.currentStatus,
        newStatus: newStatus.currentStatus,
        caseType: newStatus.caseType
      }
    };

    this.alerts.set(alert.id, alert);

    // Send notifications
    await this.notificationService.sendAlert(alert, trackingConfig);
  }

  /**
   * Initialize scheduled checks for tracked cases
   */
  private initializeScheduledChecks(): void {
    // Run every 15 minutes to check for cases that need updates
    cron.schedule('*/15 * * * *', async () => {
      console.log('🔄 Running scheduled case status checks...');
      
      const trackedCases = Array.from(this.trackingConfigs.values())
        .filter(config => config.trackingEnabled);

      for (const config of trackedCases) {
        try {
          const shouldCheck = this.shouldCheckCase(config);
          if (shouldCheck) {
            await this.getCaseStatus(config.receiptNumber, true);
            await this.delay(this.config.rateLimitDelay || 2000);
          }
        } catch (error) {
          console.error(`Failed to check case ${config.receiptNumber}:`, error);
        }
      }
    });

    console.log('📅 Scheduled case status checks initialized');
  }

  /**
   * Determine if a case should be checked based on its configuration
   */
  private shouldCheckCase(config: CaseTrackingConfig): boolean {
    if (!config.lastChecked) {
      return true; // Never checked before
    }

    const lastChecked = new Date(config.lastChecked).getTime();
    const now = Date.now();
    const intervalMs = config.checkInterval * 60 * 1000; // Convert minutes to milliseconds

    return (now - lastChecked) >= intervalMs;
  }

  /**
   * Identify changes between two status objects
   */
  private identifyChanges(previous: CaseStatus, current: CaseStatus): string[] {
    const changes: string[] = [];

    if (previous.currentStatus !== current.currentStatus) {
      changes.push(`Status: ${previous.currentStatus} → ${current.currentStatus}`);
    }

    if (previous.statusDescription !== current.statusDescription) {
      changes.push('Description updated');
    }

    if (previous.nextActionDate !== current.nextActionDate) {
      changes.push('Next action date changed');
    }

    return changes;
  }

  /**
   * Determine alert type based on status
   */
  private determineAlertType(status: CaseStatus): AlertType {
    const statusLower = status.currentStatus.toLowerCase();

    if (statusLower.includes('approved')) {
      return 'case_approved';
    } else if (statusLower.includes('denied') || statusLower.includes('rejected')) {
      return 'case_rejected';
    } else if (statusLower.includes('interview')) {
      return 'interview_scheduled';
    } else if (statusLower.includes('biometric')) {
      return 'biometrics_scheduled';
    } else if (statusLower.includes('card') && statusLower.includes('produced')) {
      return 'card_produced';
    } else if (statusLower.includes('rfe') || statusLower.includes('evidence')) {
      return 'rfe_received';
    } else if (statusLower.includes('transferred')) {
      return 'case_transferred';
    } else {
      return 'status_change';
    }
  }

  /**
   * Determine alert priority
   */
  private determinePriority(alertType: AlertType): 'low' | 'medium' | 'high' | 'urgent' {
    switch (alertType) {
      case 'case_approved':
      case 'card_produced':
        return 'high';
      case 'case_rejected':
      case 'rfe_received':
        return 'urgent';
      case 'interview_scheduled':
      case 'biometrics_scheduled':
        return 'high';
      case 'deadline_reminder':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Determine notification channels based on preferences
   */
  private determineNotificationChannels(config: CaseTrackingConfig, alertType: AlertType): NotificationChannel[] {
    const channels: NotificationChannel[] = [];

    if (config.notificationPreferences.email && config.email) {
      channels.push('email');
    }

    if (config.notificationPreferences.sms && config.phone) {
      channels.push('sms');
    }

    if (config.notificationPreferences.webhook) {
      channels.push('webhook');
    }

    return channels;
  }

  // Helper methods for analytics
  private calculateAverageProcessingTime(statuses: CaseStatus[]): number {
    const completedCases = statuses.filter(s => s.decisionDate && s.applicationDate);
    if (completedCases.length === 0) return 0;

    const totalDays = completedCases.reduce((sum, status) => {
      const start = new Date(status.applicationDate!).getTime();
      const end = new Date(status.decisionDate!).getTime();
      return sum + (end - start) / (1000 * 60 * 60 * 24);
    }, 0);

    return Math.round(totalDays / completedCases.length);
  }

  private calculateStatusDistribution(statuses: CaseStatus[]): Record<string, number> {
    return statuses.reduce((dist, status) => {
      dist[status.currentStatus] = (dist[status.currentStatus] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);
  }

  private calculateFormTypeDistribution(statuses: CaseStatus[]): Record<string, number> {
    return statuses.reduce((dist, status) => {
      const formType = status.formType || 'Unknown';
      dist[formType] = (dist[formType] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);
  }

  private calculateServiceCenterDistribution(statuses: CaseStatus[]): Record<string, number> {
    return statuses.reduce((dist, status) => {
      const center = status.serviceCenter || 'Unknown';
      dist[center] = (dist[center] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);
  }

  private calculateMonthlyTrends(configs: CaseTrackingConfig[]): any[] {
    // Implementation would calculate monthly trends
    return [];
  }

  private calculateAlertsByType(alerts: CaseStatusAlert[]): Record<AlertType, number> {
    return alerts.reduce((dist, alert) => {
      dist[alert.alertType] = (dist[alert.alertType] || 0) + 1;
      return dist;
    }, {} as Record<AlertType, number>);
  }

  private calculateDeliveryRate(alerts: CaseStatusAlert[]): number {
    const delivered = alerts.filter(a => a.deliveredAt).length;
    return alerts.length > 0 ? (delivered / alerts.length) * 100 : 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}