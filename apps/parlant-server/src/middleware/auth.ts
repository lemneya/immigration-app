import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    role?: string;
  };
}

export class AuthMiddleware {
  static authenticate(req: AuthRequest, res: Response, next: NextFunction) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    try {
      const jwtSecret = process.env.JWT_SECRET || 'immigration-suite-secret';
      const decoded = jwt.verify(token, jwtSecret) as any;
      req.user = decoded;
      next();
    } catch (error) {
      logger.error('Token verification failed:', error);
      return res.status(401).json({ error: 'Invalid token.' });
    }
  }
  
  static optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const jwtSecret = process.env.JWT_SECRET || 'immigration-suite-secret';
        const decoded = jwt.verify(token, jwtSecret) as any;
        req.user = decoded;
      } catch (error) {
        logger.warn('Optional auth token invalid:', error);
      }
    }
    
    next();
  }
  
  static requireRole(role: string) {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Access denied. No user information.' });
      }
      
      if (req.user.role !== role && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
      }
      
      next();
    };
  }
}