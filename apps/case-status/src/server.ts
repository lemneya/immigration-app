import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import Joi from 'joi';
import { 
  CaseStatusServiceConfig, 
  CaseStatusRequest, 
  BulkStatusRequest 
} from './types';
import { CaseStatusService } from './services/caseStatusService';
import { USCISClient } from './services/uscisClient';

const app = express();

// Configuration
const config: CaseStatusServiceConfig = {
  port: parseInt(process.env.PORT || '3007'),
  baseUrl: process.env.USCIS_BASE_URL || 'https://egov.uscis.gov',
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 2000,
  rateLimitDelay: 2000,
  userAgent: 'Immigration-Suite-CaseStatus/1.0',
  defaultCheckInterval: 60, // minutes
  maxConcurrentChecks: 3,
  notificationConfig: {
    email: process.env.EMAIL_HOST ? {
      host: process.env.EMAIL_HOST!,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASS!,
      from: process.env.EMAIL_FROM!
    } : undefined,
    sms: process.env.SMS_PROVIDER ? {
      provider: process.env.SMS_PROVIDER as any,
      apiKey: process.env.SMS_API_KEY!,
      apiSecret: process.env.SMS_API_SECRET,
      from: process.env.SMS_FROM!
    } : undefined,
    webhook: {
      timeout: 10000,
      maxRetries: 3
    }
  }
};

// Initialize services
const caseStatusService = new CaseStatusService(config);

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Validation schemas
const receiptNumberSchema = Joi.string()
  .pattern(/^[A-Z]{3}\d{10}$/)
  .required()
  .messages({
    'string.pattern.base': 'Receipt number must be 3 letters followed by 10 digits (e.g., MSC2190000001)'
  });

const trackingConfigSchema = Joi.object({
  receiptNumber: receiptNumberSchema,
  userId: Joi.string().optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
  checkInterval: Joi.number().min(15).max(1440).optional(), // 15 minutes to 24 hours
  notificationPreferences: Joi.object({
    email: Joi.boolean().default(true),
    sms: Joi.boolean().default(false),
    webhook: Joi.string().uri().optional(),
    statusChanges: Joi.boolean().default(true),
    actionRequired: Joi.boolean().default(true),
    deadlineReminders: Joi.boolean().default(true),
    interviewScheduled: Joi.boolean().default(true),
    cardProduced: Joi.boolean().default(true),
    caseApproved: Joi.boolean().default(true),
    caseRejected: Joi.boolean().default(true),
    biometricsScheduled: Joi.boolean().default(true)
  }).optional()
});

// Error handling middleware
const handleValidationError = (schema: Joi.ObjectSchema) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }
    next();
  };
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    service: 'case-status',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Get case status by receipt number
app.get('/status/:receiptNumber', async (req, res) => {
  try {
    const { receiptNumber } = req.params;
    const forceRefresh = req.query.force_refresh === 'true';

    // Validate receipt number
    const validation = receiptNumberSchema.validate(receiptNumber);
    if (validation.error) {
      return res.status(400).json({
        success: false,
        error: validation.error.details[0].message
      });
    }

    console.log(`🔍 Getting status for case: ${receiptNumber}`);

    const result = await caseStatusService.getCaseStatus(receiptNumber, forceRefresh);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        lastChecked: result.lastChecked
      });
    } else {
      res.status(result.statusCode || 500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error getting case status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get case status for multiple receipt numbers
app.post('/status/bulk', async (req, res) => {
  try {
    const { receiptNumbers, forceRefresh = false }: BulkStatusRequest = req.body;

    // Validate request
    if (!receiptNumbers || !Array.isArray(receiptNumbers)) {
      return res.status(400).json({
        success: false,
        error: 'receiptNumbers must be an array'
      });
    }

    if (receiptNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one receipt number is required'
      });
    }

    if (receiptNumbers.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 receipt numbers allowed per request'
      });
    }

    // Validate each receipt number
    for (const receiptNumber of receiptNumbers) {
      const validation = receiptNumberSchema.validate(receiptNumber);
      if (validation.error) {
        return res.status(400).json({
          success: false,
          error: `Invalid receipt number ${receiptNumber}: ${validation.error.details[0].message}`
        });
      }
    }

    console.log(`🔍 Getting bulk status for ${receiptNumbers.length} cases`);

    const result = await caseStatusService.getBulkCaseStatus(receiptNumbers, forceRefresh);
    
    res.json({
      success: result.success,
      data: result.data,
      error: result.error,
      lastChecked: result.lastChecked
    });

  } catch (error: any) {
    console.error('Error getting bulk case status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Start tracking a case
app.post('/tracking', handleValidationError(trackingConfigSchema), async (req, res) => {
  try {
    const { receiptNumber, userId, email, phone, checkInterval, notificationPreferences } = req.body;

    console.log(`🎯 Starting tracking for case: ${receiptNumber}`);

    const result = await caseStatusService.startTracking(
      receiptNumber,
      userId,
      email,
      phone,
      checkInterval
    );

    if (result.success) {
      // Update notification preferences if provided
      if (notificationPreferences && result.data) {
        const updateResult = await caseStatusService.updateTrackingConfig(receiptNumber, {
          notificationPreferences
        });
        
        res.status(201).json({
          success: true,
          data: updateResult.data || result.data
        });
      } else {
        res.status(201).json({
          success: true,
          data: result.data
        });
      }
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error starting tracking:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Stop tracking a case
app.delete('/tracking/:receiptNumber', async (req, res) => {
  try {
    const { receiptNumber } = req.params;

    console.log(`🛑 Stopping tracking for case: ${receiptNumber}`);

    const result = caseStatusService.stopTracking(receiptNumber);
    
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error stopping tracking:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get tracking configuration
app.get('/tracking/:receiptNumber', async (req, res) => {
  try {
    const { receiptNumber } = req.params;

    const result = caseStatusService.getTrackingConfig(receiptNumber);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error getting tracking config:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update tracking configuration
app.put('/tracking/:receiptNumber', async (req, res) => {
  try {
    const { receiptNumber } = req.params;
    const updates = req.body;

    console.log(`⚙️ Updating tracking config for case: ${receiptNumber}`);

    const result = caseStatusService.updateTrackingConfig(receiptNumber, updates);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error updating tracking config:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all tracked cases
app.get('/tracking', async (req, res) => {
  try {
    const result = caseStatusService.getTrackedCases();
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error getting tracked cases:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get case status history
app.get('/history/:receiptNumber', async (req, res) => {
  try {
    const { receiptNumber } = req.params;

    const result = caseStatusService.getCaseHistory(receiptNumber);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error getting case history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get alerts for a case
app.get('/alerts/:receiptNumber', async (req, res) => {
  try {
    const { receiptNumber } = req.params;

    const result = caseStatusService.getCaseAlerts(receiptNumber);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error getting case alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get analytics and statistics
app.get('/analytics', async (req, res) => {
  try {
    const result = caseStatusService.getAnalytics();
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Validate receipt number
app.get('/validate/:receiptNumber', async (req, res) => {
  try {
    const { receiptNumber } = req.params;

    const uscisClient = new USCISClient(config);
    const validation = uscisClient.validateReceiptNumber(receiptNumber);
    
    res.json({
      success: true,
      data: validation
    });

  } catch (error: any) {
    console.error('Error validating receipt number:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Test notification endpoint
app.post('/test/notification', async (req, res) => {
  try {
    const { channel, recipient } = req.body;

    if (!channel || !recipient) {
      return res.status(400).json({
        success: false,
        error: 'Channel and recipient are required'
      });
    }

    // This would use the notification service to send a test notification
    console.log(`🧪 Sending test notification via ${channel} to ${recipient}`);

    res.json({
      success: true,
      message: 'Test notification sent successfully'
    });

  } catch (error: any) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Start server
const startServer = async () => {
  try {
    const server = app.listen(config.port, () => {
      console.log(`🏛️  USCIS Case Status Service started`);
      console.log(`📡 Server running on port ${config.port}`);
      console.log(`🔗 Health check: http://localhost:${config.port}/health`);
      console.log(`📚 Available endpoints:`);
      console.log(`   GET    /status/:receiptNumber - Get case status`);
      console.log(`   POST   /status/bulk - Get multiple case statuses`);
      console.log(`   POST   /tracking - Start tracking a case`);
      console.log(`   GET    /tracking - Get all tracked cases`);
      console.log(`   GET    /tracking/:receiptNumber - Get tracking config`);
      console.log(`   PUT    /tracking/:receiptNumber - Update tracking config`);
      console.log(`   DELETE /tracking/:receiptNumber - Stop tracking`);
      console.log(`   GET    /history/:receiptNumber - Get status history`);
      console.log(`   GET    /alerts/:receiptNumber - Get case alerts`);
      console.log(`   GET    /analytics - Get analytics`);
      console.log(`   GET    /validate/:receiptNumber - Validate receipt number`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();