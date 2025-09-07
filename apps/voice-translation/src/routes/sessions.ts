import { Router } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { VoiceTranslationService } from '@/services/voiceTranslation';
import { SupportedLanguage } from '@/types';
import { logger } from '@/utils/logger';

const createSessionSchema = Joi.object({
  roomName: Joi.string().required().min(1).max(100),
  sourceLanguage: Joi.string().valid('en', 'es', 'fr', 'ar').required(),
  targetLanguages: Joi.array().items(
    Joi.string().valid('en', 'es', 'fr', 'ar')
  ).min(1).required(),
  sessionId: Joi.string().optional(),
});

const updateSessionSchema = Joi.object({
  targetLanguages: Joi.array().items(
    Joi.string().valid('en', 'es', 'fr', 'ar')
  ).optional(),
  status: Joi.string().valid('active', 'paused').optional(),
});

export function sessionRoutes(voiceTranslationService: VoiceTranslationService): Router {
  const router = Router();

  // Get all sessions
  router.get('/', (req, res) => {
    try {
      const sessions = voiceTranslationService.getAllSessions();
      
      res.json({
        success: true,
        data: sessions,
        meta: {
          total: sessions.length,
          active: sessions.filter(s => s.status === 'active').length,
          paused: sessions.filter(s => s.status === 'paused').length,
          ended: sessions.filter(s => s.status === 'ended').length,
        },
      });
      
    } catch (error) {
      logger.error('Failed to get sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve sessions',
        message: error.message,
      });
    }
  });

  // Get specific session
  router.get('/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = voiceTranslationService.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          message: `Session ${sessionId} does not exist`,
        });
      }

      res.json({
        success: true,
        data: session,
      });
      
    } catch (error) {
      logger.error('Failed to get session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve session',
        message: error.message,
      });
    }
  });

  // Create new session
  router.post('/', async (req, res) => {
    try {
      const { error, value } = createSessionSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error.details[0].message,
          details: error.details,
        });
      }

      const { roomName, sourceLanguage, targetLanguages, sessionId } = value;
      const finalSessionId = sessionId || uuidv4();

      // Check if session already exists
      const existingSession = voiceTranslationService.getSession(finalSessionId);
      if (existingSession) {
        return res.status(409).json({
          success: false,
          error: 'Session already exists',
          message: `Session ${finalSessionId} already exists`,
        });
      }

      const session = await voiceTranslationService.startTranslationSession(
        finalSessionId,
        roomName,
        sourceLanguage as SupportedLanguage,
        targetLanguages as SupportedLanguage[]
      );

      logger.info('Translation session created', {
        sessionId: finalSessionId,
        roomName,
        sourceLanguage,
        targetLanguages,
        requestId: req.id,
      });

      res.status(201).json({
        success: true,
        data: session,
        message: 'Translation session created successfully',
      });
      
    } catch (error) {
      logger.error('Failed to create session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create session',
        message: error.message,
      });
    }
  });

  // Update session
  router.patch('/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { error, value } = updateSessionSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error.details[0].message,
          details: error.details,
        });
      }

      const session = voiceTranslationService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          message: `Session ${sessionId} does not exist`,
        });
      }

      const { status, targetLanguages } = value;

      // Handle status changes
      if (status && status !== session.status) {
        if (status === 'paused' && session.status === 'active') {
          await voiceTranslationService.pauseSession(sessionId);
        } else if (status === 'active' && session.status === 'paused') {
          await voiceTranslationService.resumeSession(sessionId);
        } else {
          return res.status(400).json({
            success: false,
            error: 'Invalid status transition',
            message: `Cannot change status from ${session.status} to ${status}`,
          });
        }
      }

      // Handle target languages update
      if (targetLanguages) {
        session.targetLanguages = targetLanguages;
      }

      const updatedSession = voiceTranslationService.getSession(sessionId);

      logger.info('Translation session updated', {
        sessionId,
        changes: value,
        requestId: req.id,
      });

      res.json({
        success: true,
        data: updatedSession,
        message: 'Session updated successfully',
      });
      
    } catch (error) {
      logger.error('Failed to update session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update session',
        message: error.message,
      });
    }
  });

  // End session
  router.delete('/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = voiceTranslationService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          message: `Session ${sessionId} does not exist`,
        });
      }

      if (session.status === 'ended') {
        return res.status(400).json({
          success: false,
          error: 'Session already ended',
          message: `Session ${sessionId} is already ended`,
        });
      }

      await voiceTranslationService.endSession(sessionId);

      logger.info('Translation session ended', {
        sessionId,
        duration: session.endedAt ? 
          new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime() : 
          null,
        participants: session.participants.length,
        requestId: req.id,
      });

      res.json({
        success: true,
        message: 'Session ended successfully',
        data: {
          sessionId,
          endedAt: new Date().toISOString(),
        },
      });
      
    } catch (error) {
      logger.error('Failed to end session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to end session',
        message: error.message,
      });
    }
  });

  // Pause session
  router.post('/:sessionId/pause', async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = voiceTranslationService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          message: `Session ${sessionId} does not exist`,
        });
      }

      if (session.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Cannot pause session',
          message: `Session ${sessionId} is ${session.status}, can only pause active sessions`,
        });
      }

      await voiceTranslationService.pauseSession(sessionId);

      logger.info('Translation session paused', {
        sessionId,
        requestId: req.id,
      });

      res.json({
        success: true,
        message: 'Session paused successfully',
        data: voiceTranslationService.getSession(sessionId),
      });
      
    } catch (error) {
      logger.error('Failed to pause session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to pause session',
        message: error.message,
      });
    }
  });

  // Resume session
  router.post('/:sessionId/resume', async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = voiceTranslationService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          message: `Session ${sessionId} does not exist`,
        });
      }

      if (session.status !== 'paused') {
        return res.status(400).json({
          success: false,
          error: 'Cannot resume session',
          message: `Session ${sessionId} is ${session.status}, can only resume paused sessions`,
        });
      }

      await voiceTranslationService.resumeSession(sessionId);

      logger.info('Translation session resumed', {
        sessionId,
        requestId: req.id,
      });

      res.json({
        success: true,
        message: 'Session resumed successfully',
        data: voiceTranslationService.getSession(sessionId),
      });
      
    } catch (error) {
      logger.error('Failed to resume session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resume session',
        message: error.message,
      });
    }
  });

  return router;
}