import { Router } from 'express';
import { AuthService } from '../services/auth';
import { AuditService } from '../services/audit';
import { PIIService } from '../services/pii';
import { AuthMiddleware } from '../middleware/auth';
import { SecurityMiddleware } from '../middleware/security';
import { PERMISSIONS } from '../types';

export function createAdminRoutes(
  authService: AuthService,
  auditService: AuditService,
  piiService: PIIService,
  authMiddleware: AuthMiddleware,
  securityMiddleware: SecurityMiddleware
): Router {
  const router = Router();

  // All admin routes require authentication and admin role
  router.use(authMiddleware.authenticate);
  router.use(authMiddleware.requireAdmin);
  router.use(securityMiddleware.strictRateLimit);

  // User management routes
  
  // Get all users
  router.get('/users',
    authMiddleware.requirePermissions([PERMISSIONS.USERS_READ]),
    async (req: any, res) => {
      try {
        const users = authService.getAllUsers();
        const sanitizedUsers = users.map(user => ({
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }));

        res.json({
          success: true,
          users: sanitizedUsers,
          total: sanitizedUsers.length
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve users'
        });
      }
    }
  );

  // Create new user
  router.post('/users',
    authMiddleware.requirePermissions([PERMISSIONS.USERS_WRITE]),
    securityMiddleware.piiProtection,
    async (req: any, res) => {
      try {
        const { email, role, permissions, hashedPassword, metadata } = req.body;

        if (!email || !role) {
          return res.status(400).json({
            success: false,
            message: 'Email and role are required'
          });
        }

        const newUser = await authService.createUser(
          { email, role, permissions, hashedPassword, metadata },
          req.user.id
        );

        res.status(201).json({
          success: true,
          user: {
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            permissions: newUser.permissions,
            isActive: newUser.isActive,
            createdAt: newUser.createdAt
          }
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to create user'
        });
      }
    }
  );

  // Update user
  router.put('/users/:userId',
    authMiddleware.requirePermissions([PERMISSIONS.USERS_WRITE]),
    securityMiddleware.piiProtection,
    async (req: any, res) => {
      try {
        const { userId } = req.params;
        const updates = req.body;

        const updatedUser = await authService.updateUser(userId, updates, req.user.id);

        if (!updatedUser) {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }

        res.json({
          success: true,
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            permissions: updatedUser.permissions,
            isActive: updatedUser.isActive,
            updatedAt: updatedUser.updatedAt
          }
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to update user'
        });
      }
    }
  );

  // Delete user
  router.delete('/users/:userId',
    authMiddleware.requirePermissions([PERMISSIONS.USERS_DELETE]),
    async (req: any, res) => {
      try {
        const { userId } = req.params;

        if (userId === req.user.id) {
          return res.status(400).json({
            success: false,
            message: 'Cannot delete your own account'
          });
        }

        const deleted = await authService.deleteUser(userId, req.user.id);

        if (!deleted) {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }

        res.json({
          success: true,
          message: 'User deleted successfully'
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to delete user'
        });
      }
    }
  );

  // Audit log routes

  // Get audit logs
  router.get('/audit/logs',
    authMiddleware.requirePermissions([PERMISSIONS.ADMIN_LOGS]),
    async (req: any, res) => {
      try {
        const {
          userId,
          action,
          resource,
          severity,
          success,
          startDate,
          endDate,
          limit = 100,
          offset = 0
        } = req.query;

        const filters = {
          userId,
          action,
          resource,
          severity,
          success: success !== undefined ? success === 'true' : undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          limit: parseInt(limit),
          offset: parseInt(offset)
        };

        const result = await auditService.getLogs(filters);

        res.json({
          success: true,
          logs: result.logs,
          total: result.total,
          limit: filters.limit,
          offset: filters.offset
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve audit logs'
        });
      }
    }
  );

  // Get audit log by ID
  router.get('/audit/logs/:logId',
    authMiddleware.requirePermissions([PERMISSIONS.ADMIN_LOGS]),
    async (req, res) => {
      try {
        const { logId } = req.params;
        const log = await auditService.getLogById(logId);

        if (!log) {
          return res.status(404).json({
            success: false,
            message: 'Audit log not found'
          });
        }

        res.json({
          success: true,
          log
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve audit log'
        });
      }
    }
  );

  // Get audit statistics
  router.get('/audit/stats',
    authMiddleware.requirePermissions([PERMISSIONS.ADMIN_LOGS]),
    async (req, res) => {
      try {
        const { hours = 24 } = req.query;
        const stats = auditService.getStats(parseInt(hours as string));

        res.json({
          success: true,
          stats,
          period: `${hours} hours`
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve audit statistics'
        });
      }
    }
  );

  // Export audit logs
  router.get('/audit/export',
    authMiddleware.requirePermissions([PERMISSIONS.ADMIN_LOGS]),
    async (req: any, res) => {
      try {
        const {
          userId,
          action,
          resource,
          severity,
          success,
          startDate,
          endDate
        } = req.query;

        const filters = {
          userId,
          action,
          resource,
          severity,
          success: success !== undefined ? success === 'true' : undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined
        };

        const csvData = await auditService.exportLogs(filters);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvData);

        await auditService.log({
          userId: req.user.id,
          action: 'audit_export',
          resource: 'admin',
          details: { filters },
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          success: true,
          severity: 'medium'
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to export audit logs'
        });
      }
    }
  );

  // Security monitoring routes

  // Get failed login attempts
  router.get('/security/failed-logins',
    authMiddleware.requirePermissions([PERMISSIONS.SECURITY_READ]),
    async (req, res) => {
      try {
        const { hours = 24, limit = 100 } = req.query;
        const failedLogins = await auditService.getFailedLogins(
          parseInt(hours as string),
          parseInt(limit as string)
        );

        res.json({
          success: true,
          failedLogins,
          period: `${hours} hours`,
          count: failedLogins.length
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve failed login attempts'
        });
      }
    }
  );

  // Get suspicious activities
  router.get('/security/suspicious-activities',
    authMiddleware.requirePermissions([PERMISSIONS.SECURITY_READ]),
    async (req, res) => {
      try {
        const { hours = 24 } = req.query;
        const activities = await auditService.getSuspiciousActivity(
          parseInt(hours as string)
        );

        res.json({
          success: true,
          activities,
          period: `${hours} hours`,
          count: activities.length
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve suspicious activities'
        });
      }
    }
  );

  // System health and statistics

  // Get system statistics
  router.get('/stats',
    authMiddleware.requirePermissions([PERMISSIONS.ADMIN_DASHBOARD]),
    async (req, res) => {
      try {
        const authStats = authService.getStats();
        const auditStats = auditService.getStats();
        const piiStats = piiService.getDetectionStats();

        res.json({
          success: true,
          stats: {
            users: authStats,
            audit: auditStats,
            pii: piiStats,
            timestamp: new Date()
          }
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve system statistics'
        });
      }
    }
  );

  // Health check for all services
  router.get('/health',
    async (req, res) => {
      try {
        const [authHealth, auditHealth, piiHealth] = await Promise.all([
          Promise.resolve({ status: 'healthy' as const, details: authService.getStats() }),
          auditService.healthCheck(),
          piiService.healthCheck()
        ]);

        const overallStatus = [authHealth, auditHealth, piiHealth].every(h => h.status === 'healthy') 
          ? 'healthy' : 'unhealthy';

        res.status(overallStatus === 'healthy' ? 200 : 503).json({
          success: overallStatus === 'healthy',
          status: overallStatus,
          services: {
            auth: authHealth,
            audit: auditHealth,
            pii: piiHealth
          },
          timestamp: new Date()
        });
      } catch (error: any) {
        res.status(503).json({
          success: false,
          status: 'unhealthy',
          message: 'Health check failed',
          timestamp: new Date()
        });
      }
    }
  );

  // PII management routes

  // Test PII detection
  router.post('/pii/detect',
    authMiddleware.requirePermissions([PERMISSIONS.SECURITY_READ]),
    async (req: any, res) => {
      try {
        const { text } = req.body;

        if (!text) {
          return res.status(400).json({
            success: false,
            message: 'Text is required'
          });
        }

        const result = await piiService.detectPII(text);

        await auditService.log({
          userId: req.user.id,
          action: 'pii_detect_test',
          resource: 'admin',
          details: { 
            detectedCount: result.detectedPII.length,
            confidence: result.confidence
          },
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          success: true,
          severity: 'low'
        });

        res.json({
          success: true,
          result
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to detect PII'
        });
      }
    }
  );

  return router;
}