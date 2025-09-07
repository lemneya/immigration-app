import { Router } from 'express';
import { AuthService } from '../services/auth';
import { AuditService } from '../services/audit';
import { AuthMiddleware } from '../middleware/auth';
import { SecurityMiddleware } from '../middleware/security';
import { PERMISSIONS } from '../types';

export function createAuthRoutes(
  authService: AuthService, 
  auditService: AuditService,
  authMiddleware: AuthMiddleware,
  securityMiddleware: SecurityMiddleware
): Router {
  const router = Router();

  // Login endpoint
  router.post('/login', 
    securityMiddleware.loginRateLimit,
    securityMiddleware.sanitizeInput,
    async (req, res) => {
      try {
        const { email, password } = req.body;

        if (!email || !password) {
          return res.status(400).json({
            success: false,
            message: 'Email and password are required'
          });
        }

        const result = await authService.login(
          { email, password },
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown'
        );

        res.status(result.success ? 200 : 401).json(result);
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Login failed due to server error'
        });
      }
    }
  );

  // Logout endpoint
  router.post('/logout',
    authMiddleware.authenticate,
    async (req, res) => {
      try {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          await authService.logout(token, req.ip || 'unknown', req.get('User-Agent') || 'unknown');
        }

        res.json({ success: true, message: 'Logged out successfully' });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Logout failed due to server error'
        });
      }
    }
  );

  // Refresh token endpoint
  router.post('/refresh',
    securityMiddleware.apiRateLimit,
    async (req, res) => {
      try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
          return res.status(400).json({
            success: false,
            message: 'Refresh token is required'
          });
        }

        const result = await authService.refreshToken(refreshToken);

        if (!result) {
          return res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token'
          });
        }

        res.json({ success: true, ...result });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Token refresh failed due to server error'
        });
      }
    }
  );

  // Get current user info
  router.get('/me',
    authMiddleware.authenticate,
    async (req: any, res) => {
      try {
        res.json({
          success: true,
          user: {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role,
            permissions: req.user.permissions,
            lastLogin: req.user.lastLogin,
            createdAt: req.user.createdAt
          }
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to get user information'
        });
      }
    }
  );

  // Update user profile (limited fields)
  router.put('/profile',
    authMiddleware.authenticate,
    securityMiddleware.piiProtection,
    async (req: any, res) => {
      try {
        const { metadata } = req.body;
        
        const updatedUser = await authService.updateUser(
          req.user.id,
          { metadata },
          req.user.id
        );

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
            metadata: updatedUser.metadata
          }
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to update profile'
        });
      }
    }
  );

  return router;
}