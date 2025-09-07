import { EventEmitter } from 'events';
import { 
  Translation, 
  AudioTranscription, 
  TranslationProvider, 
  SupportedLanguage,
  LANGUAGE_NAMES 
} from '@/types';
import { logger } from '@/utils/logger';
import fetch from 'node-fetch';

export class TranslationService extends EventEmitter {
  private providers: Map<string, TranslationProvider> = new Map();
  private defaultProvider: string = 'google';
  private translationCache: Map<string, Translation> = new Map();

  constructor() {
    super();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Google Translate (free tier with limitations)
    this.providers.set('google', {
      name: 'Google Translate',
      endpoint: 'https://translate.googleapis.com/translate_a/single',
      supportedLanguages: ['en', 'es', 'fr', 'ar'],
    });

    // LibreTranslate (self-hosted option)
    this.providers.set('libre', {
      name: 'LibreTranslate',
      endpoint: process.env.LIBRE_TRANSLATE_URL || 'http://localhost:5000/translate',
      supportedLanguages: ['en', 'es', 'fr', 'ar'],
    });

    // Azure Translator (requires API key)
    if (process.env.AZURE_TRANSLATOR_KEY) {
      this.providers.set('azure', {
        name: 'Azure Translator',
        endpoint: 'https://api.cognitive.microsofttranslator.com/translate',
        apiKey: process.env.AZURE_TRANSLATOR_KEY,
        supportedLanguages: ['en', 'es', 'fr', 'ar'],
      });
    }

    logger.info(`Translation service initialized with ${this.providers.size} providers`);
  }

  async translateText(
    text: string,
    sourceLanguage: SupportedLanguage,
    targetLanguage: SupportedLanguage,
    sessionId: string,
    participantId: string,
    provider?: string
  ): Promise<Translation> {
    try {
      // Check cache first
      const cacheKey = `${text}:${sourceLanguage}:${targetLanguage}`;
      const cached = this.translationCache.get(cacheKey);
      if (cached) {
        logger.debug('Using cached translation', { cacheKey });
        return {
          ...cached,
          id: this.generateTranslationId(),
          sessionId,
          participantId,
          timestamp: new Date(),
        };
      }

      const selectedProvider = provider || this.defaultProvider;
      const translationProvider = this.providers.get(selectedProvider);

      if (!translationProvider) {
        throw new Error(`Translation provider '${selectedProvider}' not found`);
      }

      let translatedText: string;
      let confidence: number = 1.0;

      switch (selectedProvider) {
        case 'google':
          ({ translatedText, confidence } = await this.translateWithGoogle(
            text, sourceLanguage, targetLanguage
          ));
          break;
        case 'libre':
          ({ translatedText, confidence } = await this.translateWithLibre(
            text, sourceLanguage, targetLanguage, translationProvider
          ));
          break;
        case 'azure':
          ({ translatedText, confidence } = await this.translateWithAzure(
            text, sourceLanguage, targetLanguage, translationProvider
          ));
          break;
        default:
          throw new Error(`Unsupported provider: ${selectedProvider}`);
      }

      const translation: Translation = {
        id: this.generateTranslationId(),
        originalText: text,
        translatedText,
        sourceLanguage,
        targetLanguage,
        confidence,
        timestamp: new Date(),
        participantId,
        sessionId,
      };

      // Cache the translation
      this.translationCache.set(cacheKey, translation);

      // Clean cache if it gets too large
      if (this.translationCache.size > 1000) {
        const firstKey = this.translationCache.keys().next().value;
        this.translationCache.delete(firstKey);
      }

      logger.info('Text translated successfully', {
        sessionId,
        participantId,
        sourceLanguage,
        targetLanguage,
        textLength: text.length,
        provider: selectedProvider,
        confidence
      });

      this.emit('translation', translation);
      return translation;

    } catch (error) {
      logger.error('Translation failed:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  private async translateWithGoogle(
    text: string,
    sourceLanguage: SupportedLanguage,
    targetLanguage: SupportedLanguage
  ): Promise<{ translatedText: string; confidence: number }> {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Immigration Suite Voice Translation)',
        },
      });

      if (!response.ok) {
        throw new Error(`Google Translate API error: ${response.status}`);
      }

      const data = await response.json() as any[];
      
      // Google Translate returns a complex array structure
      // Extract the translated text from the first element
      const translatedText = data[0]
        ?.map((item: any[]) => item[0])
        .join('') || text;

      // Google Translate doesn't provide confidence scores in free API
      const confidence = 0.9;

      return { translatedText, confidence };

    } catch (error) {
      logger.error('Google Translate error:', error);
      // Fallback to LibreTranslate or return original text
      if (this.providers.has('libre')) {
        return this.translateWithLibre(text, sourceLanguage, targetLanguage, this.providers.get('libre')!);
      }
      throw error;
    }
  }

  private async translateWithLibre(
    text: string,
    sourceLanguage: SupportedLanguage,
    targetLanguage: SupportedLanguage,
    provider: TranslationProvider
  ): Promise<{ translatedText: string; confidence: number }> {
    try {
      const response = await fetch(provider.endpoint || '', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: sourceLanguage,
          target: targetLanguage,
          format: 'text',
        }),
      });

      if (!response.ok) {
        throw new Error(`LibreTranslate API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      return {
        translatedText: data.translatedText || text,
        confidence: data.confidence || 0.8,
      };

    } catch (error) {
      logger.error('LibreTranslate error:', error);
      throw error;
    }
  }

  private async translateWithAzure(
    text: string,
    sourceLanguage: SupportedLanguage,
    targetLanguage: SupportedLanguage,
    provider: TranslationProvider
  ): Promise<{ translatedText: string; confidence: number }> {
    try {
      const response = await fetch(
        `${provider.endpoint}?api-version=3.0&from=${sourceLanguage}&to=${targetLanguage}`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': provider.apiKey!,
            'Content-Type': 'application/json',
            'X-ClientTraceId': this.generateTranslationId(),
          },
          body: JSON.stringify([{ text }]),
        }
      );

      if (!response.ok) {
        throw new Error(`Azure Translator API error: ${response.status}`);
      }

      const data = await response.json() as any[];
      const translation = data[0]?.translations?.[0];
      
      return {
        translatedText: translation?.text || text,
        confidence: translation?.confidence || 0.9,
      };

    } catch (error) {
      logger.error('Azure Translator error:', error);
      throw error;
    }
  }

  async translateFromTranscription(
    transcription: AudioTranscription,
    targetLanguages: SupportedLanguage[]
  ): Promise<Translation[]> {
    const translations: Translation[] = [];

    for (const targetLanguage of targetLanguages) {
      if (targetLanguage === transcription.language) {
        continue; // Skip if target is same as source
      }

      try {
        const translation = await this.translateText(
          transcription.text,
          transcription.language as SupportedLanguage,
          targetLanguage,
          transcription.sessionId,
          transcription.participantId
        );
        translations.push(translation);
      } catch (error) {
        logger.error(`Failed to translate to ${targetLanguage}:`, error);
        // Continue with other languages
      }
    }

    return translations;
  }

  async detectLanguage(text: string): Promise<SupportedLanguage | null> {
    try {
      // Simple language detection using Google Translate
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=en&q=${encodeURIComponent(text)}`
      );

      if (!response.ok) {
        throw new Error('Language detection failed');
      }

      const data = await response.json() as any[];
      const detectedLanguage = data[2]; // Language code is in the third element

      // Map detected language to our supported languages
      const languageMap: Record<string, SupportedLanguage> = {
        'en': 'en',
        'es': 'es',
        'fr': 'fr',
        'ar': 'ar',
      };

      return languageMap[detectedLanguage] || null;

    } catch (error) {
      logger.error('Language detection error:', error);
      return null;
    }
  }

  getSupportedLanguages(): Array<{ code: SupportedLanguage; name: string }> {
    return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
      code: code as SupportedLanguage,
      name,
    }));
  }

  getProviders(): TranslationProvider[] {
    return Array.from(this.providers.values());
  }

  setDefaultProvider(provider: string): void {
    if (!this.providers.has(provider)) {
      throw new Error(`Provider '${provider}' not found`);
    }
    this.defaultProvider = provider;
    logger.info(`Default translation provider set to: ${provider}`);
  }

  private generateTranslationId(): string {
    return `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Statistics and monitoring
  getCacheSize(): number {
    return this.translationCache.size;
  }

  clearCache(): void {
    this.translationCache.clear();
    logger.info('Translation cache cleared');
  }

  // Health check method
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const providerStatuses: Record<string, boolean> = {};
      
      // Test each provider with a simple translation
      for (const [name, provider] of this.providers) {
        try {
          await this.translateText('Hello', 'en', 'es', 'health-check', 'system');
          providerStatuses[name] = true;
        } catch (error) {
          providerStatuses[name] = false;
          logger.warn(`Provider ${name} health check failed:`, error.message);
        }
      }

      const healthyProviders = Object.values(providerStatuses).filter(Boolean).length;
      const totalProviders = this.providers.size;

      return {
        status: healthyProviders > 0 ? 'healthy' : 'unhealthy',
        details: {
          providers: providerStatuses,
          healthyProviders,
          totalProviders,
          defaultProvider: this.defaultProvider,
          cacheSize: this.getCacheSize(),
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