import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { LiveKitService } from './livekit';
import { SpeechService } from './speech';
import { TranslationService } from './translation';
import { 
  TranslationSession, 
  AudioTranscription, 
  Translation, 
  SpeechSynthesis,
  SupportedLanguage,
  LiveKitConfig,
  SpeechConfig
} from '../types';
import { logger } from '../utils/logger';

export class VoiceTranslationService extends EventEmitter {
  private liveKit: LiveKitService;
  private speech: SpeechService;
  private translation: TranslationService;
  private activeStreams: Map<string, NodeJS.ReadWriteStream> = new Map();

  constructor(liveKitConfig: LiveKitConfig, speechConfig: SpeechConfig) {
    super();
    
    this.liveKit = new LiveKitService(liveKitConfig);
    this.speech = new SpeechService(speechConfig);
    this.translation = new TranslationService();

    this.setupEventListeners();
    
    logger.info('Voice Translation Service initialized');
  }

  private setupEventListeners(): void {
    // LiveKit events
    this.liveKit.on('participantJoined', this.handleParticipantJoined.bind(this));
    this.liveKit.on('participantLeft', this.handleParticipantLeft.bind(this));
    this.liveKit.on('audioData', this.handleAudioData.bind(this));
    this.liveKit.on('sessionEnded', this.handleSessionEnded.bind(this));

    // Speech service events
    this.speech.on('transcription', this.handleTranscription.bind(this));
    this.speech.on('interim-transcription', this.handleInterimTranscription.bind(this));
    this.speech.on('synthesis', this.handleSpeechSynthesis.bind(this));
    this.speech.on('transcription-error', this.handleTranscriptionError.bind(this));

    // Translation service events
    this.translation.on('translation', this.handleTranslation.bind(this));
  }

  async startTranslationSession(
    sessionId: string,
    roomName: string,
    sourceLanguage: SupportedLanguage,
    targetLanguages: SupportedLanguage[]
  ): Promise<TranslationSession> {
    try {
      logger.info('Starting voice translation session', {
        sessionId,
        roomName,
        sourceLanguage,
        targetLanguages
      });

      // Create LiveKit session
      const session = await this.liveKit.createSession(
        sessionId,
        roomName,
        sourceLanguage,
        targetLanguages
      );

      // Emit session started event
      this.emit('sessionStarted', session);
      
      return session;

    } catch (error) {
      logger.error('Failed to start translation session:', error);
      throw error;
    }
  }

  async addParticipant(
    sessionId: string,
    participantId: string,
    language: SupportedLanguage,
    role: 'speaker' | 'listener' = 'speaker'
  ): Promise<void> {
    try {
      await this.liveKit.addParticipantToSession(sessionId, participantId, language, role);
      
      // If participant is a speaker, set up streaming speech recognition
      if (role === 'speaker') {
        const streamId = `${sessionId}:${participantId}`;
        const recognizeStream = await this.speech.createStreamingRecognition(
          language,
          sessionId,
          participantId
        );
        this.activeStreams.set(streamId, recognizeStream);
      }

      this.emit('participantAdded', { sessionId, participantId, language, role });
      
    } catch (error) {
      logger.error('Failed to add participant:', error);
      throw error;
    }
  }

  private async handleParticipantJoined(event: { sessionId: string; participant: any }): Promise<void> {
    const { sessionId, participant } = event;
    
    logger.info('Participant joined translation session', {
      sessionId,
      participantId: participant.id
    });

    this.emit('participantJoined', event);
  }

  private async handleParticipantLeft(event: { sessionId: string; participantId: string }): Promise<void> {
    const { sessionId, participantId } = event;
    
    // Clean up streaming recognition for this participant
    const streamId = `${sessionId}:${participantId}`;
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      (stream as any).destroy?.();
      this.activeStreams.delete(streamId);
    }

    logger.info('Participant left translation session', {
      sessionId,
      participantId
    });

    this.emit('participantLeft', event);
  }

  private async handleAudioData(event: {
    sessionId: string;
    participantId: string;
    audioData: Buffer;
    timestamp: Date;
  }): Promise<void> {
    const { sessionId, participantId, audioData } = event;
    
    try {
      // Get participant's language
      const session = this.liveKit.getSession(sessionId);
      if (!session) return;

      const participant = session.participants.find(p => p.id === participantId);
      if (!participant) return;

      // Send audio data to streaming recognition
      const streamId = `${sessionId}:${participantId}`;
      const stream = this.activeStreams.get(streamId);
      if (stream) {
        stream.write(audioData);
      } else {
        // Fallback to batch transcription
        await this.speech.transcribeAudio(
          audioData,
          participant.language as SupportedLanguage,
          sessionId,
          participantId
        );
      }

    } catch (error) {
      logger.error('Failed to process audio data:', error);
    }
  }

  private async handleTranscription(transcription: AudioTranscription): Promise<void> {
    const { sessionId, participantId, text, language } = transcription;
    
    if (!text || text.trim().length === 0) return;

    logger.info('Audio transcribed', {
      sessionId,
      participantId,
      language,
      textLength: text.length,
      confidence: transcription.confidence
    });

    // Get target languages for translation
    const session = this.liveKit.getSession(sessionId);
    if (!session) return;

    // Translate to all target languages except the source language
    const targetLanguages = session.targetLanguages.filter(lang => lang !== language);
    
    if (targetLanguages.length > 0) {
      try {
        const translations = await this.translation.translateFromTranscription(
          transcription,
          targetLanguages as SupportedLanguage[]
        );

        // Process each translation
        for (const translation of translations) {
          await this.handleTranslation(translation);
        }

      } catch (error) {
        logger.error('Failed to translate transcription:', error);
      }
    }

    this.emit('transcription', transcription);
  }

  private handleInterimTranscription(transcription: AudioTranscription): void {
    // Emit interim results for real-time feedback
    this.emit('interimTranscription', transcription);
  }

  private handleTranscriptionError(event: {
    sessionId: string;
    participantId: string;
    error: Error;
  }): void {
    logger.error('Transcription error:', event.error);
    this.emit('transcriptionError', event);
  }

  private async handleTranslation(translation: Translation): Promise<void> {
    const { sessionId, translatedText, targetLanguage } = translation;
    
    logger.info('Text translated', {
      sessionId,
      sourceLanguage: translation.sourceLanguage,
      targetLanguage: translation.targetLanguage,
      confidence: translation.confidence
    });

    try {
      // Convert translated text to speech
      const synthesis = await this.speech.synthesizeSpeech(
        translatedText,
        targetLanguage as SupportedLanguage,
        translation.id
      );

      // The synthesis will be handled by handleSpeechSynthesis
      
    } catch (error) {
      logger.error('Failed to synthesize speech for translation:', error);
    }

    this.emit('translation', translation);
  }

  private async handleSpeechSynthesis(synthesis: SpeechSynthesis): Promise<void> {
    const { translationId, audioBuffer, language } = synthesis;
    
    logger.info('Speech synthesized', {
      translationId,
      language,
      audioSize: audioBuffer.length,
      duration: synthesis.duration
    });

    try {
      // Find the session for this translation
      const translation = await this.findTranslationById(translationId);
      if (!translation) return;

      const { sessionId } = translation;

      // Get participants who should receive this translated audio
      const session = this.liveKit.getSession(sessionId);
      if (!session) return;

      const targetParticipants = session.participants
        .filter(p => p.language === language && p.role === 'listener')
        .map(p => p.id);

      // Publish audio to LiveKit room for target participants
      await this.liveKit.publishAudioToSession(
        sessionId,
        audioBuffer,
        targetParticipants
      );

    } catch (error) {
      logger.error('Failed to publish synthesized audio:', error);
    }

    this.emit('synthesis', synthesis);
  }

  private async handleSessionEnded(event: { sessionId: string }): Promise<void> {
    const { sessionId } = event;
    
    // Clean up all streaming recognitions for this session
    for (const [streamId, stream] of this.activeStreams) {
      if (streamId.startsWith(sessionId)) {
        (stream as any).destroy?.();
        this.activeStreams.delete(streamId);
      }
    }

    logger.info('Translation session ended', { sessionId });
    this.emit('sessionEnded', event);
  }

  // Utility methods
  private async findTranslationById(translationId: string): Promise<Translation | null> {
    // In a real implementation, you'd query a database
    // For now, we'll emit an event to request the translation
    return new Promise((resolve) => {
      this.emit('requestTranslation', translationId, resolve);
    });
  }

  async pauseSession(sessionId: string): Promise<void> {
    await this.liveKit.pauseSession(sessionId);
    this.emit('sessionPaused', { sessionId });
  }

  async resumeSession(sessionId: string): Promise<void> {
    await this.liveKit.resumeSession(sessionId);
    this.emit('sessionResumed', { sessionId });
  }

  async endSession(sessionId: string): Promise<void> {
    await this.liveKit.endSession(sessionId);
    // Cleanup is handled by handleSessionEnded
  }

  getSession(sessionId: string): TranslationSession | undefined {
    return this.liveKit.getSession(sessionId);
  }

  getAllSessions(): TranslationSession[] {
    return this.liveKit.getAllSessions();
  }

  getActiveSessionsCount(): number {
    return this.liveKit.getActiveSessionsCount();
  }

  // Health check for the entire service
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const [liveKitHealth, speechHealth, translationHealth] = await Promise.all([
        this.liveKit.healthCheck(),
        this.speech.healthCheck(),
        this.translation.healthCheck(),
      ]);

      const overallHealthy = 
        liveKitHealth.status === 'healthy' &&
        speechHealth.status === 'healthy' &&
        translationHealth.status === 'healthy';

      return {
        status: overallHealthy ? 'healthy' : 'unhealthy',
        details: {
          livekit: liveKitHealth,
          speech: speechHealth,
          translation: translationHealth,
          activeSessions: this.getActiveSessionsCount(),
          activeStreams: this.activeStreams.size,
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
        }
      };
    }
  }
}