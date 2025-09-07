/**
 * Bmore Mail Service - Document Intelligence & Understanding
 * 
 * Processes uploaded documents through OCR, translation, and AI analysis
 * to provide plain-language summaries and actionable insights
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

import { logger } from './utils/logger';
import { DatabaseService } from './services/DatabaseService';
import { MailProcessorService } from './services/MailProcessorService';
import { routes } from './routes';

// Environment configuration
const PORT = process.env.PORT || 3005;
const NODE_ENV = process.env.NODE_ENV || 'development';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // Requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: NODE_ENV === 'production' 
    ? ['https://bmore.app', 'https://app.bmore.com'] 
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    } catch (error) {
      logger.error('Failed to create upload directory:', error);
      cb(error as Error, UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept images and PDFs
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not supported`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 5 // Max 5 files per request
  }
});

// Global services
let dbService: DatabaseService;
let mailProcessor: MailProcessorService;

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });

  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await dbService?.isHealthy() ? 'up' : 'down';
    const processorStatus = mailProcessor ? 'up' : 'down';

    const health = {
      service: 'mail-service',
      status: dbStatus === 'up' && processorStatus === 'up' ? 'healthy' : 'degraded',
      version: '1.0.0',
      dependencies: {
        database: dbStatus,
        processor: processorStatus,
        ocr_service: 'unknown', // Will be checked by processor
        mt_gateway: 'unknown',   // Will be checked by processor
        embed_service: 'unknown' // Will be checked by processor
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };

    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      service: 'mail-service',
      status: 'unhealthy',
      error: 'Service check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api', routes);

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size must be less than 50MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        message: 'Maximum 5 files allowed per request'
      });
    }
  }

  const statusCode = error.message.includes('not supported') ? 400 : 500;
  
  res.status(statusCode).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : error.message,
    timestamp: new Date().toISOString(),
    ...(NODE_ENV === 'development' && { stack: error.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} is not a valid endpoint`,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(async () => {
    try {
      // Close database connections
      if (dbService) {
        await dbService.close();
      }
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Initialize services and start server
async function startServer() {
  try {
    logger.info('Starting Bmore Mail Service...');

    // Initialize database service
    dbService = new DatabaseService();
    await dbService.connect();
    logger.info('Database service connected');

    // Initialize mail processor
    mailProcessor = new MailProcessorService(dbService);
    await mailProcessor.initialize();
    logger.info('Mail processor initialized');

    // Make services available globally
    app.locals.dbService = dbService;
    app.locals.mailProcessor = mailProcessor;

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`Mail service listening on port ${PORT}`, {
        environment: NODE_ENV,
        port: PORT,
        uploadDir: UPLOAD_DIR
      });
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        logger.error('Server error:', error);
        throw error;
      }
    });

    return server;

  } catch (error) {
    logger.error('Failed to start mail service:', error);
    process.exit(1);
  }
}

// Start the server
const server = startServer();

export default app;