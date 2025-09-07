import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { AuthService } from './services/auth';
import { AuditService } from './services/audit';
import { PIIService } from './services/pii';
import { AuthMiddleware } from './middleware/auth';
import { SecurityMiddleware } from './middleware/security';
import { createAuthRoutes } from './routes/auth';
import { createAdminRoutes } from './routes/admin';
import { SecurityConfig } from './types';

// Load environment variables
dotenv.config();

// Security configuration
const config: SecurityConfig = {
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'your-access-secret-key',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100') // 100 requests per window
  },
  pii: {
    enabled: process.env.PII_DETECTION_ENABLED === 'true',
    autoMask: process.env.PII_AUTO_MASK === 'true',
    sensitivity: (process.env.PII_SENSITIVITY as 'low' | 'medium' | 'high') || 'medium'
  },
  audit: {
    enabled: process.env.AUDIT_ENABLED !== 'false', // Default to true
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '90'),
    logLevel: (process.env.AUDIT_LOG_LEVEL as 'basic' | 'detailed') || 'basic'
  }
};

class SecurityServer {
  private app: express.Application;
  private authService: AuthService;
  private auditService: AuditService;
  private piiService: PIIService;
  private authMiddleware: AuthMiddleware;
  private securityMiddleware: SecurityMiddleware;

  constructor() {
    this.app = express();
    this.initializeServices();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeServices() {
    // Initialize services
    this.auditService = new AuditService(config);
    this.piiService = new PIIService(config);
    this.authService = new AuthService(config, this.auditService);
    
    // Initialize middleware classes
    this.authMiddleware = new AuthMiddleware(this.authService, this.auditService);
    this.securityMiddleware = new SecurityMiddleware(this.auditService, this.piiService, config);

    logger.info('Security services initialized successfully');
  }

  private initializeMiddleware() {
    // Trust proxy (important for getting real IP addresses)
    this.app.set('trust proxy', 1);

    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS
    this.app.use(cors(this.securityMiddleware.corsOptions));

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Security middleware
    this.app.use(this.securityMiddleware.securityHeaders);
    this.app.use(this.securityMiddleware.sanitizeInput);
    this.app.use(this.securityMiddleware.suspiciousActivityDetection);
    this.app.use(this.securityMiddleware.requestLogger);

    // General API rate limiting
    this.app.use('/api/', this.securityMiddleware.apiRateLimit);

    logger.info('Security middleware initialized');
  }

  private initializeRoutes() {
    // Health check endpoint (public)
    this.app.get('/health', async (req, res) => {
      try {
        const [auditHealth, piiHealth] = await Promise.all([
          this.auditService.healthCheck(),
          this.piiService.healthCheck()
        ]);

        const authStats = this.authService.getStats();
        const overallStatus = auditHealth.status === 'healthy' && piiHealth.status === 'healthy' 
          ? 'healthy' : 'unhealthy';

        res.status(overallStatus === 'healthy' ? 200 : 503).json({
          status: overallStatus,
          services: {
            auth: { status: 'healthy', ...authStats },
            audit: auditHealth,
            pii: piiHealth
          },
          version: process.env.npm_package_version || '1.0.0',
          timestamp: new Date()
        });
      } catch (error: any) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          message: 'Health check failed',
          timestamp: new Date()
        });
      }
    });

    // API routes
    this.app.use('/api/auth', createAuthRoutes(
      this.authService,
      this.auditService,
      this.authMiddleware,
      this.securityMiddleware
    ));

    this.app.use('/api/admin', createAdminRoutes(
      this.authService,
      this.auditService,
      this.piiService,
      this.authMiddleware,
      this.securityMiddleware
    ));

    // Protected PII detection endpoint for other services
    this.app.post('/api/pii/detect',
      this.authMiddleware.authenticate,
      this.authMiddleware.requirePermissions(['security:read']),
      async (req: any, res) => {
        try {
          const { text } = req.body;

          if (!text) {
            return res.status(400).json({
              success: false,
              message: 'Text is required'
            });
          }

          const result = await this.piiService.detectPII(text);

          await this.auditService.log({
            userId: req.user.id,
            action: 'pii_detection',
            resource: 'pii',
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
            result: {
              ...result,
              // Don't send the original text back for security
              text: '[PROCESSED]'
            }
          });
        } catch (error: any) {
          logger.error('PII detection error:', error);
          res.status(500).json({
            success: false,
            message: 'PII detection failed'
          });
        }
      }
    );

    // Catch-all route for undefined endpoints
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found'
      });
    });

    logger.info('Routes initialized');
  }

  private initializeErrorHandling() {
    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', error);

      // Log security-related errors
      this.auditService.log({
        action: 'server_error',
        resource: 'system',
        details: { 
          error: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method
        },
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success: false,
        severity: 'critical'
      }).catch(err => logger.error('Failed to log error:', err));

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.gracefulShutdown('uncaughtException');
    });

    // Unhandled promise rejection
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection:', { reason, promise });
      this.gracefulShutdown('unhandledRejection');
    });
  }

  private gracefulShutdown(signal: string) {
    logger.info(`${signal} received, shutting down gracefully...`);
    
    // Clean up resources
    this.authService.cleanupExpiredTokens();
    
    process.exit(0);
  }

  public start() {
    const port = parseInt(process.env.PORT || '3010');
    const host = process.env.HOST || '0.0.0.0';

    this.app.listen(port, host, () => {
      logger.info(`Security server started on ${host}:${port}`);
      logger.info('Configuration:', {
        piiEnabled: config.pii.enabled,
        auditEnabled: config.audit.enabled,
        nodeEnv: process.env.NODE_ENV || 'development'
      });

      // Log service startup
      this.auditService.log({
        action: 'service_start',
        resource: 'system',
        details: { 
          port, 
          host,
          config: {
            piiEnabled: config.pii.enabled,
            auditEnabled: config.audit.enabled
          }
        },
        ipAddress: '127.0.0.1',
        userAgent: 'system',
        success: true,
        severity: 'low'
      }).catch(err => logger.error('Failed to log startup:', err));
    });
  }
}

// Start the server
if (require.main === module) {
  try {
    const server = new SecurityServer();
    server.start();
  } catch (error) {
    logger.error('Failed to start security server:', error);
    process.exit(1);
  }
}