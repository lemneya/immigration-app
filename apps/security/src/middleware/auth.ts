import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth';
import { AuditService } from '../services/audit';
import { User } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export class AuthMiddleware {
  private authService: AuthService;
  private auditService: AuditService;

  constructor(authService: AuthService, auditService: AuditService) {
    this.authService = authService;
    this.auditService = auditService;
  }

  // Middleware to authenticate JWT tokens
  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.header('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        await this.auditService.log({
          action: 'auth_missing',
          resource: 'middleware',
          details: { path: req.path, method: req.method },
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          success: false,
          severity: 'low'
        });

        res.status(401).json({ 
          success: false, 
          message: 'Access token is required' 
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const user = await this.authService.verifyToken(token);

      if (!user) {
        await this.auditService.log({
          action: 'auth_invalid',
          resource: 'middleware',
          details: { path: req.path, method: req.method, token: token.substring(0, 10) + '...' },
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          success: false,
          severity: 'medium'
        });

        res.status(401).json({ 
          success: false, 
          message: 'Invalid or expired token' 
        });
        return;
      }

      req.user = user;
      next();

    } catch (error: any) {
      await this.auditService.log({
        action: 'auth_error',
        resource: 'middleware',
        details: { error: error.message, path: req.path, method: req.method },
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success: false,
        severity: 'high'
      });

      res.status(500).json({ 
        success: false, 
        message: 'Authentication error' 
      });
    }
  };

  // Middleware to check if user has required permissions
  requirePermissions = (permissions: string[]) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ 
            success: false, 
            message: 'User not authenticated' 
          });
          return;
        }

        const hasAllPermissions = permissions.every(permission => 
          req.user!.permissions.includes(permission)
        );

        if (!hasAllPermissions) {
          await this.auditService.log({
            userId: req.user.id,
            action: 'permission_denied',
            resource: 'middleware',
            details: { 
              requiredPermissions: permissions,
              userPermissions: req.user.permissions,
              path: req.path,
              method: req.method
            },
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            success: false,
            severity: 'medium'
          });

          res.status(403).json({ 
            success: false, 
            message: 'Insufficient permissions' 
          });
          return;
        }

        next();

      } catch (error: any) {
        await this.auditService.log({
          userId: req.user?.id,
          action: 'permission_error',
          resource: 'middleware',
          details: { error: error.message, path: req.path, method: req.method },
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          success: false,
          severity: 'high'
        });

        res.status(500).json({ 
          success: false, 
          message: 'Permission check error' 
        });
      }
    };
  };

  // Middleware to check if user has required role
  requireRole = (roles: string[]) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ 
            success: false, 
            message: 'User not authenticated' 
          });
          return;
        }

        if (!roles.includes(req.user.role)) {
          await this.auditService.log({
            userId: req.user.id,
            action: 'role_denied',
            resource: 'middleware',
            details: { 
              requiredRoles: roles,
              userRole: req.user.role,
              path: req.path,
              method: req.method
            },
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            success: false,
            severity: 'medium'
          });

          res.status(403).json({ 
            success: false, 
            message: 'Insufficient role privileges' 
          });
          return;
        }

        next();

      } catch (error: any) {
        await this.auditService.log({
          userId: req.user?.id,
          action: 'role_error',
          resource: 'middleware',
          details: { error: error.message, path: req.path, method: req.method },
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          success: false,
          severity: 'high'
        });

        res.status(500).json({ 
          success: false, 
          message: 'Role check error' 
        });
      }
    };
  };

  // Optional authentication - doesn't fail if no token provided
  optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.header('Authorization');
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const user = await this.authService.verifyToken(token);
        
        if (user) {
          req.user = user;
        }
      }

      next();

    } catch (error: any) {
      // Don't fail on optional auth errors, just log them
      await this.auditService.log({
        action: 'optional_auth_error',
        resource: 'middleware',
        details: { error: error.message, path: req.path, method: req.method },
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success: false,
        severity: 'low'
      });

      next();
    }
  };

  // Admin-only access
  requireAdmin = this.requireRole(['admin']);

  // Operator or Admin access
  requireOperator = this.requireRole(['admin', 'operator']);
}