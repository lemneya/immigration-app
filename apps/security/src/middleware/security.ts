import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AuditService } from '../services/audit';
import { PIIService } from '../services/pii';
import { SecurityConfig } from '../types';

export class SecurityMiddleware {
  private auditService: AuditService;
  private piiService: PIIService;
  private config: SecurityConfig;

  constructor(auditService: AuditService, piiService: PIIService, config: SecurityConfig) {
    this.auditService = auditService;
    this.piiService = piiService;
    this.config = config;
    
    // Initialize rate limiters now that config is set
    this.strictRateLimit = this.createRateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5 // limit each IP to 5 requests per windowMs
    });

    this.loginRateLimit = this.createRateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10 // limit each IP to 10 login attempts per windowMs
    });

    this.apiRateLimit = this.createRateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 API requests per windowMs
    });
  }

  // Rate limiting middleware
  createRateLimiter = (customOptions?: Partial<typeof this.config.rateLimit>) => {
    const options = { ...this.config.rateLimit, ...customOptions };
    
    return rateLimit({
      windowMs: options.windowMs,
      max: options.max,
      message: {
        success: false,
        message: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: async (req: Request, res: Response) => {
        await this.auditService.log({
          action: 'rate_limit_exceeded',
          resource: 'security',
          details: { 
            path: req.path, 
            method: req.method,
            limit: options.max,
            window: options.windowMs
          },
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          success: false,
          severity: 'medium'
        });

        res.status(429).json({
          success: false,
          message: 'Too many requests, please try again later'
        });
      },
      keyGenerator: (req: Request) => {
        // Use IP + User-Agent for more specific rate limiting
        return `${req.ip}-${req.get('User-Agent') || 'unknown'}`;
      }
    });
  };

  // Rate limiters (initialized in constructor)
  strictRateLimit: any;
  loginRateLimit: any;
  apiRateLimit: any;

  // PII detection and masking middleware
  piiProtection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.config.pii.enabled) {
        return next();
      }

      // Check request body for PII
      if (req.body && typeof req.body === 'object') {
        const textContent = JSON.stringify(req.body);
        const piiResult = await this.piiService.detectPII(textContent);

        if (piiResult.detectedPII.length > 0) {
          await this.auditService.log({
            action: 'pii_detected',
            resource: 'security',
            details: { 
              path: req.path,
              method: req.method,
              piiTypes: piiResult.detectedPII.map(p => p.type),
              confidence: piiResult.confidence
            },
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            success: true,
            severity: 'high'
          });

          // If autoMask is enabled, replace the request body with masked version
          if (this.config.pii.autoMask) {
            try {
              req.body = JSON.parse(piiResult.maskedText);
            } catch (error) {
              // If parsing fails, keep original but log the issue
              await this.auditService.log({
                action: 'pii_mask_error',
                resource: 'security',
                details: { error: 'Failed to parse masked PII content' },
                ipAddress: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                success: false,
                severity: 'medium'
              });
            }
          }
        }
      }

      next();

    } catch (error: any) {
      await this.auditService.log({
        action: 'pii_protection_error',
        resource: 'security',
        details: { error: error.message, path: req.path },
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success: false,
        severity: 'high'
      });

      // Don't fail the request on PII protection errors, but log them
      next();
    }
  };

  // Request sanitization middleware
  sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Basic sanitization of common XSS patterns
      const sanitizeValue = (value: any): any => {
        if (typeof value === 'string') {
          return value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '');
        }
        if (typeof value === 'object' && value !== null) {
          const sanitized: any = {};
          for (const [key, val] of Object.entries(value)) {
            sanitized[key] = sanitizeValue(val);
          }
          return sanitized;
        }
        return value;
      };

      if (req.body) {
        req.body = sanitizeValue(req.body);
      }
      if (req.query) {
        req.query = sanitizeValue(req.query);
      }
      if (req.params) {
        req.params = sanitizeValue(req.params);
      }

      next();

    } catch (error: any) {
      next(); // Don't fail on sanitization errors
    }
  };

  // Security headers middleware
  securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // HSTS header for HTTPS
    if (req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
  };

  // Request logging middleware
  requestLogger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    
    // Override res.end to capture response details
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      // Log request details (async, don't block response)
      setImmediate(async () => {
        try {
          await this.auditService.log({
            action: 'http_request',
            resource: 'api',
            details: {
              method: req.method,
              path: req.path,
              statusCode,
              duration,
              contentLength: res.get('content-length'),
              query: req.query
            },
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            success: statusCode < 400,
            severity: statusCode >= 400 ? (statusCode >= 500 ? 'high' : 'medium') : 'low'
          });
        } catch (error) {
          // Don't let logging errors affect the response
        }
      });

      originalEnd.call(this, chunk, encoding);
    }.bind(this);

    next();
  };

  // Suspicious activity detection
  suspiciousActivityDetection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suspiciousPatterns = [
        /\.\.\//, // Path traversal
        /<script/i, // XSS attempts
        /union\s+select/i, // SQL injection
        /base64_decode/i, // PHP injection
        /eval\(/i, // Code injection
        /document\.cookie/i, // Cookie stealing
      ];

      const requestContent = JSON.stringify({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers
      });

      const isSuspicious = suspiciousPatterns.some(pattern => 
        pattern.test(requestContent)
      );

      if (isSuspicious) {
        await this.auditService.log({
          action: 'suspicious_activity',
          resource: 'security',
          details: {
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            body: req.body,
            query: req.query
          },
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          success: false,
          severity: 'high'
        });

        // For now, just log but don't block. In production, you might want to block or challenge
      }

      next();

    } catch (error: any) {
      next(); // Don't fail on detection errors
    }
  };

  // IP whitelist middleware (for admin endpoints)
  ipWhitelist = (allowedIPs: string[]) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const clientIP = req.ip;
      
      if (!allowedIPs.includes(clientIP || '')) {
        await this.auditService.log({
          action: 'ip_blocked',
          resource: 'security',
          details: { 
            blockedIP: clientIP,
            allowedIPs,
            path: req.path
          },
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          success: false,
          severity: 'high'
        });

        res.status(403).json({
          success: false,
          message: 'Access denied from this IP address'
        });
        return;
      }

      next();
    };
  };

  // CORS configuration
  corsOptions = {
    origin: (origin: string | undefined, callback: Function) => {
      // In production, you'd want to maintain a whitelist of allowed origins
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://immigration-suite.gov',
        // Add your production domains here
      ];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count']
  };
}