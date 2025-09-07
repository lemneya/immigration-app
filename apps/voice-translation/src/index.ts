import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { VoiceTranslationService } from './services/voiceTranslation';
import { createRoutes } from './routes';
import { createWebSocketServer } from './websocket';
import { logger } from './utils/logger';
import { LiveKitConfig, SpeechConfig } from './types';

// Load environment variables
dotenv.config();

// Configuration
const PORT = process.env.PORT || 3009;
const NODE_ENV = process.env.NODE_ENV || 'development';

// LiveKit configuration
const liveKitConfig: LiveKitConfig = {
  url: process.env.LIVEKIT_URL || 'wss://livekit-server.example.com',
  apiKey: process.env.LIVEKIT_API_KEY || 'your-api-key',
  secretKey: process.env.LIVEKIT_SECRET_KEY || 'your-secret-key',
};

// Speech service configuration
const speechConfig: SpeechConfig = {
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'your-project-id',
    keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
  },
  supportedLanguages: [
    {
      code: 'en',
      name: 'English',
      voices: [
        { name: 'en-US-Wavenet-A', gender: 'female', language: 'en-US' },
        { name: 'en-US-Wavenet-B', gender: 'male', language: 'en-US' },
      ]
    },
    {
      code: 'es',
      name: 'Spanish',
      voices: [
        { name: 'es-ES-Wavenet-A', gender: 'female', language: 'es-ES' },
        { name: 'es-ES-Wavenet-B', gender: 'male', language: 'es-ES' },
      ]
    },
    {
      code: 'fr',
      name: 'French',
      voices: [
        { name: 'fr-FR-Wavenet-A', gender: 'female', language: 'fr-FR' },
        { name: 'fr-FR-Wavenet-B', gender: 'male', language: 'fr-FR' },
      ]
    },
    {
      code: 'ar',
      name: 'Arabic',
      voices: [
        { name: 'ar-XA-Wavenet-A', gender: 'female', language: 'ar-XA' },
        { name: 'ar-XA-Wavenet-B', gender: 'male', language: 'ar-XA' },
      ]
    },
  ],
};

async function startServer() {
  try {
    logger.info('Starting Voice Translation Service...');

    // Initialize Express app
    const app = express();
    const server = createServer(app);

    // Initialize voice translation service
    const voiceTranslationService = new VoiceTranslationService(
      liveKitConfig,
      speechConfig
    );

    // Middleware
    app.use(helmet({
      contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
    }));
    
    app.use(cors({
      origin: process.env.CORS_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3008',
      ],
      credentials: true,
    }));
    
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });

    // Health check endpoint
    app.get('/health', async (req, res) => {
      try {
        const health = await voiceTranslationService.healthCheck();
        res.status(health.status === 'healthy' ? 200 : 503).json({
          status: health.status,
          timestamp: new Date().toISOString(),
          service: 'voice-translation',
          version: process.env.npm_package_version || '1.0.0',
          details: health.details,
        });
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message,
        });
      }
    });

    // API routes
    const apiRoutes = createRoutes(voiceTranslationService);
    app.use('/api', apiRoutes);

    // WebSocket server
    const io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3008',
        ],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    createWebSocketServer(io, voiceTranslationService);

    // Error handling
    app.use((error: any, req: any, res: any, next: any) => {
      logger.error('Unhandled error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Voice Translation Service started`, {
        port: PORT,
        environment: NODE_ENV,
        liveKitUrl: liveKitConfig.url,
        supportedLanguages: speechConfig.supportedLanguages.map(l => l.code),
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();