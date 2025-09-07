import { AuditLog, SecurityConfig } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class AuditService {
  private config: SecurityConfig;
  private logs: Map<string, AuditLog> = new Map();
  private logQueue: AuditLog[] = [];
  private isProcessingQueue = false;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.startPeriodicCleanup();
  }

  async log(auditData: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.audit.enabled) {
      return;
    }

    try {
      const auditLog: AuditLog = {
        id: uuidv4(),
        timestamp: new Date(),
        ...auditData
      };

      // Store in memory (in production, this would go to persistent storage)
      this.logs.set(auditLog.id, auditLog);

      // Add to processing queue
      this.logQueue.push(auditLog);
      this.processQueue();

      // Log to application logger based on severity
      const logMessage = `Audit: ${auditLog.action} on ${auditLog.resource}`;
      const logData = {
        auditId: auditLog.id,
        userId: auditLog.userId,
        action: auditLog.action,
        resource: auditLog.resource,
        success: auditLog.success,
        severity: auditLog.severity,
        ipAddress: auditLog.ipAddress
      };

      switch (auditLog.severity) {
        case 'critical':
          logger.error(logMessage, logData);
          break;
        case 'high':
          logger.warn(logMessage, logData);
          break;
        case 'medium':
          logger.info(logMessage, logData);
          break;
        case 'low':
        default:
          if (this.config.audit.logLevel === 'detailed') {
            logger.debug(logMessage, logData);
          }
          break;
      }

    } catch (error: any) {
      logger.error('Failed to create audit log:', error);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.logQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // In production, this would batch insert to database
      const batch = this.logQueue.splice(0, 100); // Process in batches of 100
      
      for (const log of batch) {
        // Simulate async database write
        await this.persistLog(log);
      }

      logger.debug(`Processed ${batch.length} audit logs`);
    } catch (error: any) {
      logger.error('Error processing audit queue:', error);
    } finally {
      this.isProcessingQueue = false;
      
      // Process remaining queue if needed
      if (this.logQueue.length > 0) {
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  private async persistLog(log: AuditLog): Promise<void> {
    // In production, this would write to MongoDB or other persistent storage
    // For now, we just simulate the async operation
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  async getLogs(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    severity?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      let filteredLogs = Array.from(this.logs.values());

      // Apply filters
      if (filters.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
      }

      if (filters.action) {
        filteredLogs = filteredLogs.filter(log => log.action.includes(filters.action));
      }

      if (filters.resource) {
        filteredLogs = filteredLogs.filter(log => log.resource === filters.resource);
      }

      if (filters.severity) {
        filteredLogs = filteredLogs.filter(log => log.severity === filters.severity);
      }

      if (filters.success !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.success === filters.success);
      }

      if (filters.startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!);
      }

      if (filters.endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!);
      }

      // Sort by timestamp (most recent first)
      filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const total = filteredLogs.length;
      
      // Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || 100;
      const paginatedLogs = filteredLogs.slice(offset, offset + limit);

      return { logs: paginatedLogs, total };

    } catch (error: any) {
      logger.error('Error retrieving audit logs:', error);
      return { logs: [], total: 0 };
    }
  }

  async getLogById(id: string): Promise<AuditLog | null> {
    return this.logs.get(id) || null;
  }

  async getLogsByUser(userId: string, limit = 100): Promise<AuditLog[]> {
    const result = await this.getLogs({ userId, limit });
    return result.logs;
  }

  async getLogsByAction(action: string, limit = 100): Promise<AuditLog[]> {
    const result = await this.getLogs({ action, limit });
    return result.logs;
  }

  async getFailedLogins(hours = 24, limit = 100): Promise<AuditLog[]> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await this.getLogs({
      action: 'login_failed',
      success: false,
      startDate,
      limit
    });
    return result.logs;
  }

  async getSuspiciousActivity(hours = 24): Promise<AuditLog[]> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await this.getLogs({
      severity: 'high',
      startDate,
      success: false
    });
    return result.logs;
  }

  async getSecurityIncidents(hours = 24): Promise<AuditLog[]> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await this.getLogs({
      severity: 'critical',
      startDate
    });
    return result.logs;
  }

  getStats(hours = 24): {
    total: number;
    successful: number;
    failed: number;
    bySeverity: Record<string, number>;
    byAction: Record<string, number>;
    byResource: Record<string, number>;
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentLogs = Array.from(this.logs.values())
      .filter(log => log.timestamp >= cutoff);

    const stats = {
      total: recentLogs.length,
      successful: recentLogs.filter(log => log.success).length,
      failed: recentLogs.filter(log => !log.success).length,
      bySeverity: {} as Record<string, number>,
      byAction: {} as Record<string, number>,
      byResource: {} as Record<string, number>
    };

    // Count by severity
    recentLogs.forEach(log => {
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
      stats.byResource[log.resource] = (stats.byResource[log.resource] || 0) + 1;
    });

    return stats;
  }

  // Clean up old logs based on retention policy
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupOldLogs();
    }, 24 * 60 * 60 * 1000); // Run daily

    // Initial cleanup
    this.cleanupOldLogs();
  }

  private cleanupOldLogs(): void {
    if (!this.config.audit.retentionDays) {
      return;
    }

    const cutoffDate = new Date(Date.now() - this.config.audit.retentionDays * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [id, log] of this.logs) {
      if (log.timestamp < cutoffDate) {
        this.logs.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old audit logs`);
    }
  }

  // Export logs for compliance or analysis
  async exportLogs(filters: Parameters<typeof this.getLogs>[0] = {}): Promise<string> {
    const { logs } = await this.getLogs(filters);
    
    // Convert to CSV format
    const headers = [
      'ID', 'Timestamp', 'User ID', 'Action', 'Resource', 'Resource ID',
      'Success', 'Severity', 'IP Address', 'User Agent', 'Session ID', 'Details'
    ];

    const csvRows = [
      headers.join(','),
      ...logs.map(log => [
        log.id,
        log.timestamp.toISOString(),
        log.userId || '',
        log.action,
        log.resource,
        log.resourceId || '',
        log.success.toString(),
        log.severity,
        log.ipAddress,
        `"${log.userAgent}"`,
        log.sessionId || '',
        `"${JSON.stringify(log.details).replace(/"/g, '""')}"`
      ].join(','))
    ];

    return csvRows.join('\n');
  }

  // Health check for audit service
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const queueLength = this.logQueue.length;
      const totalLogs = this.logs.size;
      const recentLogs = Array.from(this.logs.values())
        .filter(log => log.timestamp > new Date(Date.now() - 60 * 60 * 1000)).length;

      const isHealthy = queueLength < 1000 && this.config.audit.enabled;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: {
          enabled: this.config.audit.enabled,
          queueLength,
          totalLogs,
          recentLogsLastHour: recentLogs,
          retentionDays: this.config.audit.retentionDays,
          logLevel: this.config.audit.logLevel,
          isProcessingQueue: this.isProcessingQueue
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message
        }
      };
    }
  }

  // For testing purposes - clear all logs
  clearLogs(): void {
    this.logs.clear();
    this.logQueue.length = 0;
    logger.info('All audit logs cleared');
  }
}