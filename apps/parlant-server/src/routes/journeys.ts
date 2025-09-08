import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Get available journeys
router.get('/', async (req, res) => {
  try {
    const journeys = [
      {
        id: 'intake_helper',
        name: 'Intake & Form Helper',
        description: 'Smart assistance for filling immigration forms',
        category: 'forms',
        estimatedDuration: 20
      },
      {
        id: 'mail_copilot',
        name: 'Mail Understanding Copilot',
        description: 'Analyze and understand official immigration mail',
        category: 'documents',
        estimatedDuration: 10
      },
      {
        id: 'case_concierge',
        name: 'Case Concierge',
        description: 'Guided assistance for case management',
        category: 'status',
        estimatedDuration: 15
      },
      {
        id: 'voice_pstn_handoff',
        name: 'Voice & PSTN Hand-off',
        description: 'Voice calls with translation support',
        category: 'communication',
        estimatedDuration: 30
      },
      {
        id: 'billing_nudges',
        name: 'Billing Nudges',
        description: 'Payment reminders and assistance',
        category: 'payments',
        estimatedDuration: 5
      }
    ];
    
    res.json({
      success: true,
      data: journeys
    });
  } catch (error) {
    logger.error('Error fetching journeys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journeys'
    });
  }
});

// Get specific journey details
router.get('/:journeyId', async (req, res) => {
  try {
    const { journeyId } = req.params;
    
    // This would typically fetch from database or journey manager
    const journey = {
      id: journeyId,
      name: 'Journey Name',
      description: 'Journey Description',
      steps: [],
      metadata: {}
    };
    
    res.json({
      success: true,
      data: journey
    });
  } catch (error) {
    logger.error('Error fetching journey details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journey details'
    });
  }
});

export default router;