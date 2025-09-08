import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Get immigration guidelines
router.get('/', async (req, res) => {
  try {
    const guidelines = [
      {
        id: 'no_legal_advice',
        category: 'legal',
        priority: 'high',
        title: 'No Legal Advice',
        guidance: 'Cannot provide legal advice. Refer users to qualified immigration attorneys for legal counsel.'
      },
      {
        id: 'accuracy_verification',
        category: 'procedural',
        priority: 'high',
        title: 'Verify Information Accuracy',
        guidance: 'Always remind users to verify information with official USCIS sources.'
      },
      {
        id: 'confidentiality',
        category: 'safety',
        priority: 'high',
        title: 'Protect Personal Information',
        guidance: 'Remind users not to share sensitive personal information in chat.'
      }
    ];
    
    res.json({
      success: true,
      data: guidelines
    });
  } catch (error) {
    logger.error('Error fetching guidelines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch guidelines'
    });
  }
});

// Get glossary terms
router.get('/glossary', async (req, res) => {
  try {
    const glossaryTerms = [
      {
        term: 'A-Number',
        definition: 'Alien Registration Number - a unique identifier assigned by USCIS to each immigrant',
        category: 'identification'
      },
      {
        term: 'Receipt Number',
        definition: 'A 13-character identifier given for each case filed with USCIS',
        category: 'case_tracking'
      },
      {
        term: 'Green Card',
        definition: 'Permanent Resident Card - proof of lawful permanent resident status in the United States',
        category: 'status'
      }
    ];
    
    res.json({
      success: true,
      data: glossaryTerms
    });
  } catch (error) {
    logger.error('Error fetching glossary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch glossary'
    });
  }
});

export default router;