import { Router } from 'express';
import { VoiceTranslationService } from '../services/voiceTranslation';
import { sessionRoutes } from './sessions';
import { participantRoutes } from './participants';
import { translationRoutes } from './translations';
import pstnRoutes from './pstn';
import { logger } from '../utils/logger';

export function createRoutes(voiceTranslationService: VoiceTranslationService): Router {
  const router = Router();

  // Add request ID for tracking
  router.use((req, res, next) => {
    req.id = Math.random().toString(36).substr(2, 9);
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // Service info endpoint
  router.get('/', (req, res) => {
    res.json({
      service: 'voice-translation',
      version: '1.0.0',
      description: 'Real-time voice translation service with LiveKit integration',
      endpoints: {
        sessions: '/api/sessions',
        participants: '/api/participants',
        translations: '/api/translations',
        pstn: '/api/pstn',
        health: '/health',
      },
      supportedLanguages: ['en', 'es', 'fr', 'ar'],
    });
  });

  // Mount route modules
  router.use('/sessions', sessionRoutes(voiceTranslationService));
  router.use('/participants', participantRoutes(voiceTranslationService));
  router.use('/translations', translationRoutes(voiceTranslationService));
  router.use('/pstn', pstnRoutes);

  // Service statistics endpoint
  router.get('/stats', async (req, res) => {
    try {
      const sessions = voiceTranslationService.getAllSessions();
      const activeSessions = sessions.filter(s => s.status === 'active');
      
      const stats = {
        totalSessions: sessions.length,
        activeSessions: activeSessions.length,
        totalParticipants: sessions.reduce((sum, s) => sum + s.participants.length, 0),
        activeParticipants: activeSessions.reduce(
          (sum, s) => sum + s.participants.filter(p => p.isConnected).length, 
          0
        ),
        languageBreakdown: {
          sessions: sessions.reduce((acc, session) => {
            acc[session.sourceLanguage] = (acc[session.sourceLanguage] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          participants: sessions.reduce((acc, session) => {
            session.participants.forEach(p => {
              acc[p.language] = (acc[p.language] || 0) + 1;
            });
            return acc;
          }, {} as Record<string, number>),
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };

      res.json(stats);
      
    } catch (error) {
      logger.error('Failed to get service stats:', error);
      res.status(500).json({
        error: 'Failed to retrieve statistics',
        message: error.message,
      });
    }
  });

  return router;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}