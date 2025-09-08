import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Import routes
import roomRoutes from './routes/room';
import translationRoutes from './routes/translation';
import recordingRoutes from './routes/recording';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3013;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'video-consultation',
    version: '1.0.0'
  });
});

// API routes
app.use('/api/rooms', roomRoutes);
app.use('/api/translation', translationRoutes);
app.use('/api/recordings', recordingRoutes);

// Socket.IO for real-time video communication
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', async (data) => {
    socket.join(data.roomId);
    socket.to(data.roomId).emit('user-joined', { userId: socket.id });
  });

  socket.on('leave-room', async (data) => {
    socket.leave(data.roomId);
    socket.to(data.roomId).emit('user-left', { userId: socket.id });
  });

  socket.on('video-offer', (data) => {
    socket.to(data.roomId).emit('video-offer', data);
  });

  socket.on('video-answer', (data) => {
    socket.to(data.roomId).emit('video-answer', data);
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`Video Consultation Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;