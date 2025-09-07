import { Router } from 'express';
import Joi from 'joi';
import { VoiceTranslationService } from '@/services/voiceTranslation';
import { SupportedLanguage } from '@/types';
import { logger } from '@/utils/logger';

const addParticipantSchema = Joi.object({
  participantId: Joi.string().required().min(1).max(100),
  language: Joi.string().valid('en', 'es', 'fr', 'ar').required(),
  role: Joi.string().valid('speaker', 'listener').default('speaker'),
  name: Joi.string().optional().max(100),
});

export function participantRoutes(voiceTranslationService: VoiceTranslationService): Router {
  const router = Router();

  // Get all participants for a session
  router.get('/', (req, res) => {
    try {
      const { sessionId } = req.query;
      
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing sessionId parameter',
          message: 'sessionId query parameter is required',
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

      res.json({
        success: true,
        data: session.participants,
        meta: {
          sessionId,
          total: session.participants.length,
          connected: session.participants.filter(p => p.isConnected).length,
          speakers: session.participants.filter(p => p.role === 'speaker').length,
          listeners: session.participants.filter(p => p.role === 'listener').length,
        },
      });
      
    } catch (error) {
      logger.error('Failed to get participants:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve participants',
        message: error.message,
      });
    }
  });

  // Get specific participant
  router.get('/:participantId', (req, res) => {
    try {
      const { participantId } = req.params;
      const { sessionId } = req.query;
      
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing sessionId parameter',
          message: 'sessionId query parameter is required',
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

      const participant = session.participants.find(p => p.id === participantId);
      if (!participant) {
        return res.status(404).json({
          success: false,
          error: 'Participant not found',
          message: `Participant ${participantId} not found in session ${sessionId}`,
        });
      }

      res.json({
        success: true,
        data: participant,
      });
      
    } catch (error) {
      logger.error('Failed to get participant:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve participant',
        message: error.message,
      });
    }
  });

  // Add participant to session
  router.post('/', async (req, res) => {
    try {
      const { sessionId } = req.query;
      
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing sessionId parameter',
          message: 'sessionId query parameter is required',
        });
      }

      const { error, value } = addParticipantSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error.details[0].message,
          details: error.details,
        });
      }

      const { participantId, language, role, name } = value;

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
          error: 'Session ended',
          message: `Cannot add participants to ended session ${sessionId}`,
        });
      }

      // Check if participant already exists
      const existingParticipant = session.participants.find(p => p.id === participantId);
      if (existingParticipant && existingParticipant.isConnected) {
        return res.status(409).json({
          success: false,
          error: 'Participant already connected',
          message: `Participant ${participantId} is already connected to session ${sessionId}`,
        });
      }

      await voiceTranslationService.addParticipant(
        sessionId,
        participantId,
        language as SupportedLanguage,
        role
      );

      // Update participant name if provided
      const updatedSession = voiceTranslationService.getSession(sessionId);
      if (name && updatedSession) {
        const participant = updatedSession.participants.find(p => p.id === participantId);
        if (participant) {
          participant.name = name;
        }
      }

      logger.info('Participant added to session', {
        sessionId,
        participantId,
        language,
        role,
        name,
        requestId: req.id,
      });

      res.status(201).json({
        success: true,
        data: updatedSession?.participants.find(p => p.id === participantId),
        message: 'Participant added successfully',
      });
      
    } catch (error) {
      logger.error('Failed to add participant:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add participant',
        message: error.message,
      });
    }
  });

  // Update participant
  router.patch('/:participantId', async (req, res) => {
    try {
      const { participantId } = req.params;
      const { sessionId } = req.query;
      
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing sessionId parameter',
          message: 'sessionId query parameter is required',
        });
      }

      const updateSchema = Joi.object({
        language: Joi.string().valid('en', 'es', 'fr', 'ar').optional(),
        role: Joi.string().valid('speaker', 'listener').optional(),
        name: Joi.string().max(100).optional(),
      });

      const { error, value } = updateSchema.validate(req.body);
      
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

      const participantIndex = session.participants.findIndex(p => p.id === participantId);
      if (participantIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Participant not found',
          message: `Participant ${participantId} not found in session ${sessionId}`,
        });
      }

      // Update participant properties
      const participant = session.participants[participantIndex];
      Object.assign(participant, value);

      logger.info('Participant updated', {
        sessionId,
        participantId,
        changes: value,
        requestId: req.id,
      });

      res.json({
        success: true,
        data: participant,
        message: 'Participant updated successfully',
      });
      
    } catch (error) {
      logger.error('Failed to update participant:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update participant',
        message: error.message,
      });
    }
  });

  // Remove participant from session
  router.delete('/:participantId', async (req, res) => {
    try {
      const { participantId } = req.params;
      const { sessionId } = req.query;
      
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing sessionId parameter',
          message: 'sessionId query parameter is required',
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

      const participantIndex = session.participants.findIndex(p => p.id === participantId);
      if (participantIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Participant not found',
          message: `Participant ${participantId} not found in session ${sessionId}`,
        });
      }

      // Mark participant as disconnected
      const participant = session.participants[participantIndex];
      participant.isConnected = false;
      participant.leftAt = new Date();

      logger.info('Participant removed from session', {
        sessionId,
        participantId,
        duration: participant.leftAt.getTime() - participant.joinedAt.getTime(),
        requestId: req.id,
      });

      res.json({
        success: true,
        message: 'Participant removed successfully',
        data: {
          participantId,
          leftAt: participant.leftAt.toISOString(),
        },
      });
      
    } catch (error) {
      logger.error('Failed to remove participant:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove participant',
        message: error.message,
      });
    }
  });

  return router;
}