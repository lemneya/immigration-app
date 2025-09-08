import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import { ConversationEngine } from './core/ConversationEngine';
import { AuthMiddleware } from './middleware/auth';
import { logger } from './utils/logger';

import conversationRoutes from './routes/conversations';
import journeyRoutes from './routes/journeys';
import toolRoutes from './routes/tools';
import guidelinesRoutes from './routes/guidelines';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const conversationEngine = new ConversationEngine(io);

app.use('/api/conversations', conversationRoutes);
app.use('/api/journeys', journeyRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/guidelines', guidelinesRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join-conversation', async (conversationId: string) => {
    socket.join(conversationId);
    await conversationEngine.handleSocketConnection(socket, conversationId);
  });

  socket.on('send-message', async (data) => {
    await conversationEngine.handleMessage(socket, data);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

async function startServer() {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/parlant';
    await mongoose.connect(mongoUrl);
    logger.info('Connected to MongoDB');

    // Connect to Redis
    const redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err) => logger.error('Redis Client Error', err));
    await redisClient.connect();
    logger.info('Connected to Redis');

    // Start server
    const port = process.env.PORT || 3020;
    httpServer.listen(port, () => {
      logger.info(`Parlant server running on port ${port}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();