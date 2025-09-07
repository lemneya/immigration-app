export interface TranslationSession {
  id: string;
  roomName: string;
  participants: Participant[];
  sourceLanguage: string;
  targetLanguages: string[];
  status: 'active' | 'paused' | 'ended';
  startedAt: Date;
  endedAt?: Date;
  metadata?: Record<string, any>;
}

export interface Participant {
  id: string;
  name: string;
  role: 'speaker' | 'listener';
  language: string;
  joinedAt: Date;
  leftAt?: Date;
  isConnected: boolean;
}

export interface AudioTranscription {
  sessionId: string;
  participantId: string;
  text: string;
  language: string;
  confidence: number;
  timestamp: Date;
  duration: number;
}

export interface Translation {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  timestamp: Date;
  participantId: string;
  sessionId: string;
}

export interface SpeechSynthesis {
  translationId: string;
  audioBuffer: Buffer;
  language: string;
  voice: string;
  duration: number;
  timestamp: Date;
}

export interface LiveKitConfig {
  url: string;
  apiKey: string;
  secretKey: string;
}

export interface SpeechConfig {
  googleCloud: {
    projectId: string;
    keyFilename?: string;
  };
  supportedLanguages: {
    code: string;
    name: string;
    voices: Voice[];
  }[];
}

export interface Voice {
  name: string;
  gender: 'male' | 'female' | 'neutral';
  language: string;
}

export interface TranslationProvider {
  name: string;
  endpoint?: string;
  apiKey?: string;
  supportedLanguages: string[];
}

export interface WebSocketMessage {
  type: 'transcription' | 'translation' | 'synthesis' | 'session_update' | 'error';
  payload: any;
  sessionId: string;
  participantId?: string;
  timestamp: Date;
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  uptime: number;
  lastCheck: Date;
  dependencies: {
    livekit: boolean;
    speechToText: boolean;
    textToSpeech: boolean;
    translation: boolean;
  };
}

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'ar';

export const LANGUAGE_CODES: Record<SupportedLanguage, string> = {
  en: 'en-US',
  es: 'es-ES', 
  fr: 'fr-FR',
  ar: 'ar-XA'
};

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  ar: 'Arabic'
};