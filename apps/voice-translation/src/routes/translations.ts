import { Router } from 'express';
import Joi from 'joi';
import { VoiceTranslationService } from '@/services/voiceTranslation';
import { SupportedLanguage } from '@/types';
import { logger } from '@/utils/logger';

const translateTextSchema = Joi.object({
  text: Joi.string().required().min(1).max(10000),
  sourceLanguage: Joi.string().valid('en', 'es', 'fr', 'ar').required(),
  targetLanguage: Joi.string().valid('en', 'es', 'fr', 'ar').required(),
  provider: Joi.string().valid('google', 'libre', 'azure').optional(),
});

export function translationRoutes(voiceTranslationService: VoiceTranslationService): Router {
  const router = Router();

  // Get supported languages
  router.get('/languages', (req, res) => {
    try {
      const languages = [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'ar', name: 'Arabic' },
      ];

      res.json({
        success: true,
        data: {
          supported: languages,
          providers: ['google', 'libre', 'azure'],
          features: {
            speechToText: true,
            textToSpeech: true,
            realTimeTranslation: true,
            batchTranslation: true,
          },
        },
      });
      
    } catch (error) {
      logger.error('Failed to get supported languages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve supported languages',
        message: error.message,
      });
    }
  });

  // Translate text directly (not part of a session)
  router.post('/translate', async (req, res) => {
    try {
      const { error, value } = translateTextSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error.details[0].message,
          details: error.details,
        });
      }

      const { text, sourceLanguage, targetLanguage, provider } = value;

      if (sourceLanguage === targetLanguage) {
        return res.status(400).json({
          success: false,
          error: 'Invalid language pair',
          message: 'Source and target languages cannot be the same',
        });
      }

      // Use the translation service directly for standalone translations
      // Note: This creates a temporary session for the translation
      const sessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const participantId = 'system';

      const translation = await voiceTranslationService['translation'].translateText(
        text,
        sourceLanguage as SupportedLanguage,
        targetLanguage as SupportedLanguage,
        sessionId,
        participantId,
        provider
      );

      logger.info('Direct text translation', {
        sourceLanguage,
        targetLanguage,
        textLength: text.length,
        provider: provider || 'default',
        confidence: translation.confidence,
        requestId: req.id,
      });

      res.json({
        success: true,
        data: {
          originalText: translation.originalText,
          translatedText: translation.translatedText,
          sourceLanguage: translation.sourceLanguage,
          targetLanguage: translation.targetLanguage,
          confidence: translation.confidence,
          provider: provider || 'google',
        },
        message: 'Text translated successfully',
      });
      
    } catch (error) {
      logger.error('Failed to translate text:', error);
      res.status(500).json({
        success: false,
        error: 'Translation failed',
        message: error.message,
      });
    }
  });

  // Get translation history for a session
  router.get('/history', (req, res) => {
    try {
      const { sessionId, limit = 100, offset = 0 } = req.query;
      
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing sessionId parameter',
          message: 'sessionId query parameter is required',
        });
      }

      // In a real implementation, this would query a database
      // For now, we'll return a placeholder response
      res.json({
        success: true,
        data: {
          sessionId,
          translations: [], // Placeholder - would contain translation history
          meta: {
            total: 0,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
          },
        },
        message: 'Translation history endpoint - not fully implemented',
      });
      
    } catch (error) {
      logger.error('Failed to get translation history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve translation history',
        message: error.message,
      });
    }
  });

  // Get available voices for text-to-speech
  router.get('/voices', async (req, res) => {
    try {
      const { language } = req.query;
      
      const speechService = voiceTranslationService['speech'];
      const voices = await speechService.getAvailableVoices(
        language as SupportedLanguage
      );

      res.json({
        success: true,
        data: {
          voices: voices.map(voice => ({
            name: voice.name,
            language: voice.languageCodes?.[0] || 'unknown',
            gender: voice.ssmlGender?.toLowerCase() || 'unknown',
            sampleRate: voice.naturalSampleRateHertz,
          })),
          filterByLanguage: language || 'all',
        },
      });
      
    } catch (error) {
      logger.error('Failed to get available voices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve available voices',
        message: error.message,
      });
    }
  });

  // Test text-to-speech synthesis
  router.post('/synthesize', async (req, res) => {
    try {
      const synthesizeSchema = Joi.object({
        text: Joi.string().required().min(1).max(5000),
        language: Joi.string().valid('en', 'es', 'fr', 'ar').required(),
        voice: Joi.string().optional(),
      });

      const { error, value } = synthesizeSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error.details[0].message,
          details: error.details,
        });
      }

      const { text, language, voice } = value;
      const translationId = `synth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const speechService = voiceTranslationService['speech'];
      const synthesis = await speechService.synthesizeSpeech(
        text,
        language as SupportedLanguage,
        translationId,
        voice
      );

      logger.info('Text-to-speech synthesis', {
        language,
        voice,
        textLength: text.length,
        audioSize: synthesis.audioBuffer.length,
        duration: synthesis.duration,
        requestId: req.id,
      });

      // Return the audio as base64 for web clients
      res.json({
        success: true,
        data: {
          audio: synthesis.audioBuffer.toString('base64'),
          language: synthesis.language,
          voice: synthesis.voice,
          duration: synthesis.duration,
          format: 'ogg_opus',
        },
        message: 'Speech synthesized successfully',
      });
      
    } catch (error) {
      logger.error('Failed to synthesize speech:', error);
      res.status(500).json({
        success: false,
        error: 'Speech synthesis failed',
        message: error.message,
      });
    }
  });

  // Get translation statistics
  router.get('/stats', (req, res) => {
    try {
      const translationService = voiceTranslationService['translation'];
      
      // Get basic statistics
      const stats = {
        cacheSize: translationService.getCacheSize(),
        providers: translationService.getProviders().map(p => ({
          name: p.name,
          supportedLanguages: p.supportedLanguages.length,
        })),
        supportedLanguages: translationService.getSupportedLanguages(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: stats,
      });
      
    } catch (error) {
      logger.error('Failed to get translation stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve translation statistics',
        message: error.message,
      });
    }
  });

  // Clear translation cache (admin endpoint)
  router.delete('/cache', (req, res) => {
    try {
      const translationService = voiceTranslationService['translation'];
      const oldCacheSize = translationService.getCacheSize();
      
      translationService.clearCache();
      
      logger.info('Translation cache cleared', {
        oldCacheSize,
        requestId: req.id,
      });

      res.json({
        success: true,
        message: 'Translation cache cleared successfully',
        data: {
          clearedEntries: oldCacheSize,
          timestamp: new Date().toISOString(),
        },
      });
      
    } catch (error) {
      logger.error('Failed to clear translation cache:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear translation cache',
        message: error.message,
      });
    }
  });

  return router;
}