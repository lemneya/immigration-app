import express from 'express';
import multer from 'multer';
import { MailUnderstandingService } from '../services/MailUnderstandingService';
import { CredentialPathwaysService } from '../services/CredentialPathwaysService';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const mailUnderstandingService = new MailUnderstandingService();
const credentialPathwaysService = new CredentialPathwaysService();

/**
 * POST /mail/understand
 * Comprehensive document understanding
 */
router.post('/understand', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No document provided'
      });
    }

    const analysis = await mailUnderstandingService.understandDocument(
      req.file.buffer,
      req.file.originalname
    );

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Document understanding failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to understand document',
      message: error.message
    });
  }
});

/**
 * POST /mail/translate
 * Translate document text
 */
router.post('/translate', async (req, res) => {
  try {
    const { text, fromLanguage, toLanguage } = req.body;
    
    if (!text || !fromLanguage || !toLanguage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: text, fromLanguage, toLanguage'
      });
    }

    const translatedText = await mailUnderstandingService.translateText({
      text,
      fromLanguage,
      toLanguage
    });

    res.json({
      success: true,
      data: {
        originalText: text,
        translatedText,
        fromLanguage,
        toLanguage
      }
    });
  } catch (error) {
    console.error('Translation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Translation failed',
      message: error.message
    });
  }
});

/**
 * POST /mail/summarize
 * Generate document summary
 */
router.post('/summarize', async (req, res) => {
  try {
    const { text, type = 'document' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    // For now, create a simple summary
    const summary = text.length > 500 ? text.substring(0, 497) + '...' : text;

    res.json({
      success: true,
      data: {
        originalLength: text.length,
        summary,
        type
      }
    });
  } catch (error) {
    console.error('Summarization failed:', error);
    res.status(500).json({
      success: false,
      error: 'Summarization failed',
      message: error.message
    });
  }
});

/**
 * POST /mail/checklist
 * Generate action checklist from document
 */
router.post('/checklist', async (req, res) => {
  try {
    const { text, documentType } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    // Simple checklist generation
    const checklist = [
      {
        id: '1',
        item: 'Review document contents',
        priority: 'high',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        completed: false
      },
      {
        id: '2', 
        item: 'Translate if needed',
        priority: 'medium',
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
        completed: false
      },
      {
        id: '3',
        item: 'Take required action',
        priority: 'high',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        completed: false
      }
    ];

    res.json({
      success: true,
      data: {
        documentType,
        checklist,
        totalItems: checklist.length
      }
    });
  } catch (error) {
    console.error('Checklist generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Checklist generation failed',
      message: error.message
    });
  }
});

/**
 * POST /credentials/analyze
 * Analyze uploaded credentials
 */
router.post('/credentials/analyze', upload.single('credential'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No credential document provided'
      });
    }

    const analysis = await credentialPathwaysService.analyzeCredentials(
      req.file.buffer,
      req.file.originalname
    );

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Credential analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze credentials',
      message: error.message
    });
  }
});

/**
 * GET /credentials/pathways/:profession
 * Get career pathways for a profession
 */
router.get('/credentials/pathways/:profession', async (req, res) => {
  try {
    const { profession } = req.params;
    
    const pathways = await credentialPathwaysService.getPathwayRequirements(profession);

    res.json({
      success: true,
      data: {
        profession,
        pathways,
        count: pathways.length
      }
    });
  } catch (error) {
    console.error('Failed to get pathways:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pathways',
      message: error.message
    });
  }
});

/**
 * GET /credentials/requirements/:profession
 * Get licensing requirements for a profession
 */
router.get('/credentials/requirements/:profession', async (req, res) => {
  try {
    const { profession } = req.params;
    const { state } = req.query;
    
    const requirements = await credentialPathwaysService.getLicensingRequirements(
      profession, 
      state as string
    );

    res.json({
      success: true,
      data: {
        profession,
        state,
        requirements,
        count: requirements.length
      }
    });
  } catch (error) {
    console.error('Failed to get requirements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get licensing requirements',
      message: error.message
    });
  }
});

export default router;