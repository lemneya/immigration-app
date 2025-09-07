import { Server as SocketIOServer, Socket } from 'socket.io';
import { VoiceTranslationService } from '@/services/voiceTranslation';
import { 
  WebSocketMessage, 
  AudioTranscription, 
  Translation, 
  SpeechSynthesis,
  SupportedLanguage 
} from '@/types';
import { logger } from '@/utils/logger';

interface ClientInfo {
  sessionId?: string;
  participantId?: string;
  language?: SupportedLanguage;
  role?: 'speaker' | 'listener';
}

export function createWebSocketServer(
  io: SocketIOServer, 
  voiceTranslationService: VoiceTranslationService
): void {
  const clients = new Map<string, ClientInfo>();

  io.on('connection', (socket: Socket) => {
    logger.info('WebSocket client connected', { 
      socketId: socket.id,
      clientIp: socket.handshake.address 
    });

    // Join session
    socket.on('join-session', async (data: {
      sessionId: string;
      participantId: string;
      language: SupportedLanguage;
      role?: 'speaker' | 'listener';
      name?: string;
    }) => {
      try {
        const { sessionId, participantId, language, role = 'speaker', name } = data;

        // Validate session exists
        const session = voiceTranslationService.getSession(sessionId);
        if (!session) {
          socket.emit('error', {
            type: 'SESSION_NOT_FOUND',
            message: `Session ${sessionId} not found`,
            sessionId,
          });
          return;
        }

        // Add participant to session if not already added
        try {
          await voiceTranslationService.addParticipant(sessionId, participantId, language, role);
        } catch (error) {
          // Participant might already exist, which is okay
          logger.debug('Participant already exists or error adding:', error.message);
        }

        // Store client info
        clients.set(socket.id, { sessionId, participantId, language, role });

        // Join socket room for session
        socket.join(sessionId);

        // Notify other participants
        socket.to(sessionId).emit('participant-joined', {
          sessionId,
          participant: {
            id: participantId,
            name: name || participantId,
            language,
            role,
            joinedAt: new Date().toISOString(),
          },
        });

        socket.emit('joined-session', {
          sessionId,
          participantId,
          session: voiceTranslationService.getSession(sessionId),
        });

        logger.info('Client joined translation session', {
          socketId: socket.id,
          sessionId,
          participantId,
          language,
          role,
        });

      } catch (error) {
        logger.error('Failed to join session:', error);
        socket.emit('error', {
          type: 'JOIN_SESSION_FAILED',
          message: error.message,
          sessionId: data.sessionId,
        });
      }
    });

    // Leave session
    socket.on('leave-session', (data: { sessionId: string; participantId: string }) => {
      try {
        const { sessionId, participantId } = data;
        
        socket.leave(sessionId);
        
        // Notify other participants
        socket.to(sessionId).emit('participant-left', {
          sessionId,
          participantId,
          leftAt: new Date().toISOString(),
        });

        // Remove from clients map
        clients.delete(socket.id);

        logger.info('Client left translation session', {
          socketId: socket.id,
          sessionId,
          participantId,
        });

      } catch (error) {
        logger.error('Failed to leave session:', error);
        socket.emit('error', {
          type: 'LEAVE_SESSION_FAILED',
          message: error.message,
        });
      }
    });

    // Handle audio data for transcription
    socket.on('audio-data', async (data: {
      sessionId: string;
      participantId: string;
      audioData: string; // Base64 encoded
      timestamp: string;
    }) => {
      try {
        const clientInfo = clients.get(socket.id);
        if (!clientInfo || clientInfo.sessionId !== data.sessionId) {
          socket.emit('error', {
            type: 'UNAUTHORIZED',
            message: 'Not authorized for this session',
          });
          return;
        }

        const audioBuffer = Buffer.from(data.audioData, 'base64');
        
        // Emit audio data event to the voice translation service
        voiceTranslationService.emit('audioData', {
          sessionId: data.sessionId,
          participantId: data.participantId,
          audioData: audioBuffer,
          timestamp: new Date(data.timestamp),
        });

      } catch (error) {
        logger.error('Failed to process audio data:', error);
        socket.emit('error', {
          type: 'AUDIO_PROCESSING_FAILED',
          message: error.message,
        });
      }
    });

    // Handle manual text for translation
    socket.on('translate-text', async (data: {
      sessionId: string;
      participantId: string;
      text: string;
      sourceLanguage: SupportedLanguage;
      targetLanguages: SupportedLanguage[];
    }) => {
      try {
        const clientInfo = clients.get(socket.id);
        if (!clientInfo || clientInfo.sessionId !== data.sessionId) {
          socket.emit('error', {
            type: 'UNAUTHORIZED',
            message: 'Not authorized for this session',
          });
          return;
        }

        const { sessionId, participantId, text, sourceLanguage, targetLanguages } = data;

        // Create mock transcription for translation
        const transcription: AudioTranscription = {
          sessionId,
          participantId,
          text,
          language: sourceLanguage,
          confidence: 1.0,
          timestamp: new Date(),
          duration: 0,
        };

        // Use translation service directly
        const translations = await voiceTranslationService['translation']
          .translateFromTranscription(transcription, targetLanguages);

        // Emit translations to session participants
        translations.forEach(translation => {
          io.to(sessionId).emit('translation', {
            type: 'translation',
            payload: translation,
            sessionId,
            participantId,
            timestamp: new Date().toISOString(),
          });
        });

      } catch (error) {
        logger.error('Failed to translate text:', error);
        socket.emit('error', {
          type: 'TRANSLATION_FAILED',
          message: error.message,
        });
      }
    });

    // Handle session control commands
    socket.on('control-session', async (data: {
      sessionId: string;
      action: 'pause' | 'resume' | 'end';
    }) => {
      try {
        const clientInfo = clients.get(socket.id);
        if (!clientInfo || clientInfo.sessionId !== data.sessionId) {
          socket.emit('error', {
            type: 'UNAUTHORIZED',
            message: 'Not authorized for this session',
          });
          return;
        }

        const { sessionId, action } = data;

        switch (action) {
          case 'pause':
            await voiceTranslationService.pauseSession(sessionId);
            break;
          case 'resume':
            await voiceTranslationService.resumeSession(sessionId);
            break;
          case 'end':
            await voiceTranslationService.endSession(sessionId);
            break;
        }

        // Notify all participants
        io.to(sessionId).emit('session-updated', {
          sessionId,
          action,
          session: voiceTranslationService.getSession(sessionId),
          timestamp: new Date().toISOString(),
        });

      } catch (error) {
        logger.error('Failed to control session:', error);
        socket.emit('error', {
          type: 'SESSION_CONTROL_FAILED',
          message: error.message,
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      const clientInfo = clients.get(socket.id);
      
      if (clientInfo && clientInfo.sessionId) {
        // Notify other participants
        socket.to(clientInfo.sessionId).emit('participant-left', {
          sessionId: clientInfo.sessionId,
          participantId: clientInfo.participantId,
          leftAt: new Date().toISOString(),
          reason: 'disconnect',
        });
      }

      clients.delete(socket.id);
      
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        reason,
        sessionId: clientInfo?.sessionId,
        participantId: clientInfo?.participantId,
      });
    });

    // Generic error handler
    socket.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  });

  // Voice translation service event handlers
  voiceTranslationService.on('transcription', (transcription: AudioTranscription) => {
    const message: WebSocketMessage = {
      type: 'transcription',
      payload: transcription,
      sessionId: transcription.sessionId,
      participantId: transcription.participantId,
      timestamp: transcription.timestamp,
    };

    io.to(transcription.sessionId).emit('transcription', message);
  });

  voiceTranslationService.on('interimTranscription', (transcription: AudioTranscription) => {
    const message: WebSocketMessage = {
      type: 'transcription',
      payload: { ...transcription, interim: true },
      sessionId: transcription.sessionId,
      participantId: transcription.participantId,
      timestamp: transcription.timestamp,
    };

    io.to(transcription.sessionId).emit('interim-transcription', message);
  });

  voiceTranslationService.on('translation', (translation: Translation) => {
    const message: WebSocketMessage = {
      type: 'translation',
      payload: translation,
      sessionId: translation.sessionId,
      participantId: translation.participantId,
      timestamp: translation.timestamp,
    };

    io.to(translation.sessionId).emit('translation', message);
  });

  voiceTranslationService.on('synthesis', (synthesis: SpeechSynthesis) => {
    // Find the translation to get session info
    // Note: This is simplified - in a real implementation, you'd have proper mapping
    const message: WebSocketMessage = {
      type: 'synthesis',
      payload: {
        ...synthesis,
        audioData: synthesis.audioBuffer.toString('base64'),
      },
      sessionId: 'unknown', // Would be properly mapped in real implementation
      timestamp: synthesis.timestamp,
    };

    // Broadcast to all sessions for now - would be more targeted in real implementation
    io.emit('synthesis', message);
  });

  voiceTranslationService.on('sessionStarted', (session) => {
    io.to(session.id).emit('session-started', {
      session,
      timestamp: new Date().toISOString(),
    });
  });

  voiceTranslationService.on('sessionEnded', ({ sessionId }) => {
    io.to(sessionId).emit('session-ended', {
      sessionId,
      timestamp: new Date().toISOString(),
    });
  });

  voiceTranslationService.on('sessionPaused', ({ sessionId }) => {
    io.to(sessionId).emit('session-paused', {
      sessionId,
      timestamp: new Date().toISOString(),
    });
  });

  voiceTranslationService.on('sessionResumed', ({ sessionId }) => {
    io.to(sessionId).emit('session-resumed', {
      sessionId,
      timestamp: new Date().toISOString(),
    });
  });

  voiceTranslationService.on('participantJoined', (event) => {
    io.to(event.sessionId).emit('participant-joined', {
      ...event,
      timestamp: new Date().toISOString(),
    });
  });

  voiceTranslationService.on('participantLeft', (event) => {
    io.to(event.sessionId).emit('participant-left', {
      ...event,
      timestamp: new Date().toISOString(),
    });
  });

  logger.info('WebSocket server initialized with voice translation service integration');
}