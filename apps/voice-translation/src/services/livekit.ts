import { EventEmitter } from 'events';
import { TranslationSession, Participant, LiveKitConfig } from '@/types';
import { logger } from '@/utils/logger';

// Simplified mock implementation for development
export class LiveKitService extends EventEmitter {
  private sessions: Map<string, TranslationSession> = new Map();
  private config: LiveKitConfig;

  constructor(config: LiveKitConfig) {
    super();
    this.config = config;
    logger.info('LiveKit Service initialized (mock mode)');
  }

  async createSession(
    sessionId: string,
    roomName: string,
    sourceLanguage: string,
    targetLanguages: string[]
  ): Promise<TranslationSession> {
    try {
      const session: TranslationSession = {
        id: sessionId,
        roomName,
        participants: [],
        sourceLanguage,
        targetLanguages,
        status: 'active',
        startedAt: new Date(),
        metadata: {
          roomSid: roomName,
        }
      };

      this.sessions.set(sessionId, session);

      logger.info(`Translation session created: ${sessionId}`, { 
        roomName, 
        sourceLanguage, 
        targetLanguages 
      });

      this.emit('sessionStarted', session);
      return session;
    } catch (error: any) {
      logger.error('Failed to create translation session:', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  async addParticipantToSession(
    sessionId: string, 
    participantId: string,
    language: string,
    role: 'speaker' | 'listener' = 'speaker'
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const existingParticipant = session.participants.find(p => p.id === participantId);
    if (existingParticipant) {
      existingParticipant.language = language;
      existingParticipant.role = role;
      existingParticipant.isConnected = true;
      if (existingParticipant.leftAt) {
        delete existingParticipant.leftAt;
      }
    } else {
      const participant: Participant = {
        id: participantId,
        name: participantId,
        role,
        language,
        joinedAt: new Date(),
        isConnected: true,
      };
      session.participants.push(participant);
    }

    this.sessions.set(sessionId, session);
    this.emit('participantJoined', { sessionId, participant: { id: participantId } });
    logger.info(`Participant ${participantId} added to session ${sessionId}`, { language, role });
  }

  async pauseSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'paused';
    this.sessions.set(sessionId, session);
    
    this.emit('sessionPaused', { sessionId });
    logger.info(`Session ${sessionId} paused`);
  }

  async resumeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'active';
    this.sessions.set(sessionId, session);
    
    this.emit('sessionResumed', { sessionId });
    logger.info(`Session ${sessionId} resumed`);
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'ended';
      session.endedAt = new Date();
      this.sessions.set(sessionId, session);
    }

    this.emit('sessionEnded', { sessionId });
    logger.info(`Session ${sessionId} ended`);
  }

  getSession(sessionId: string): TranslationSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): TranslationSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessionsCount(): number {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active').length;
  }

  async publishAudioToSession(
    sessionId: string,
    audioBuffer: Buffer,
    targetParticipants?: string[]
  ): Promise<void> {
    logger.info(`Publishing audio to session ${sessionId}`, { 
      bufferSize: audioBuffer.length,
      targetParticipants 
    });
    // Mock implementation - in real app would publish to LiveKit
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const activeSessions = this.getActiveSessionsCount();
      const totalSessions = this.sessions.size;
      
      return {
        status: 'healthy',
        details: {
          activeSessions,
          totalSessions,
          uptime: process.uptime(),
          mode: 'mock',
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
        }
      };
    }
  }
}