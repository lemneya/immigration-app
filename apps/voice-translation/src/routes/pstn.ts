import express from 'express';
import { PSNTBridgeService, PSNTCallOptions } from '../services/pstn';
import { logger } from '../utils/logger';
import Joi from 'joi';

const router = express.Router();
const pstnService = new PSNTBridgeService();

// Validation schemas
const initiateCallSchema = Joi.object({
  fromNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  toNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  userId: Joi.string().required(),
  targetLanguage: Joi.string().length(2).required(),
  sourceLanguage: Joi.string().length(2).optional().default('en')
});

/**
 * POST /pstn/call
 * Initiate a PSTN call with live translation
 */
router.post('/call', async (req, res) => {
  try {
    const { error, value } = initiateCallSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details
      });
    }

    const callOptions: PSNTCallOptions = value;
    
    // Check for common immigration-related numbers
    const isUSCISNumber = callOptions.toNumber.includes('18003755283') || 
                         callOptions.toNumber.includes('+18003755283');
    
    if (isUSCISNumber) {
      logger.info(`USCIS call initiated by user ${callOptions.userId}`);
    }

    const callId = await pstnService.initiateCall(callOptions);

    res.json({
      success: true,
      data: {
        callId,
        status: 'connecting',
        message: 'Call initiated successfully'
      }
    });

  } catch (error) {
    logger.error('Failed to initiate PSTN call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate call',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /pstn/bridge/:callId
 * Bridge an active call with translation
 */
router.post('/bridge/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    
    if (!callId) {
      return res.status(400).json({
        success: false,
        error: 'Call ID is required'
      });
    }

    await pstnService.bridgeCall(callId);

    res.json({
      success: true,
      data: {
        callId,
        status: 'bridged',
        message: 'Call bridged with translation'
      }
    });

  } catch (error) {
    logger.error(`Failed to bridge call ${req.params.callId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to bridge call',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /pstn/end-call/:callId
 * End an active call
 */
router.delete('/end-call/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    
    if (!callId) {
      return res.status(400).json({
        success: false,
        error: 'Call ID is required'
      });
    }

    await pstnService.endCall(callId);

    res.json({
      success: true,
      data: {
        callId,
        status: 'ended',
        message: 'Call ended successfully'
      }
    });

  } catch (error) {
    logger.error(`Failed to end call ${req.params.callId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to end call',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /pstn/call/:callId
 * Get active call information
 */
router.get('/call/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    
    if (!callId) {
      return res.status(400).json({
        success: false,
        error: 'Call ID is required'
      });
    }

    const activeCall = pstnService.getActiveCall(callId);
    
    if (!activeCall) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    res.json({
      success: true,
      data: activeCall
    });

  } catch (error) {
    logger.error(`Failed to get call ${req.params.callId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get call information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /pstn/calls/user/:userId
 * List all active calls for a user
 */
router.get('/calls/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const activeCalls = pstnService.getUserActiveCalls(userId);

    res.json({
      success: true,
      data: {
        userId,
        activeCalls,
        count: activeCalls.length
      }
    });

  } catch (error) {
    logger.error(`Failed to get calls for user ${req.params.userId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user calls',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /pstn/status/:callId
 * Twilio webhook for call status updates
 */
router.post('/status/:callId', (req, res) => {
  try {
    const { callId } = req.params;
    const { CallStatus, CallSid } = req.body;
    
    logger.info(`Twilio status update for call ${callId}: ${CallStatus}`);
    
    pstnService.handleCallStatus(callId, CallStatus, CallSid);

    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');

  } catch (error) {
    logger.error(`Failed to handle status update for call ${req.params.callId}:`, error);
    res.status(500).send('<Response></Response>');
  }
});

/**
 * POST /pstn/conference/:callId
 * Twilio webhook for conference events
 */
router.post('/conference/:callId', (req, res) => {
  try {
    const { callId } = req.params;
    const { StatusCallbackEvent, ConferenceSid } = req.body;
    
    logger.info(`Conference event for call ${callId}: ${StatusCallbackEvent}`);
    
    // Handle conference events (join, leave, mute, etc.)
    // This can be used to trigger translation features
    
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');

  } catch (error) {
    logger.error(`Failed to handle conference event for call ${req.params.callId}:`, error);
    res.status(500).send('<Response></Response>');
  }
});

/**
 * POST /pstn/recording/:callId
 * Twilio webhook for recording events
 */
router.post('/recording/:callId', (req, res) => {
  try {
    const { callId } = req.params;
    const { RecordingStatus, RecordingUrl } = req.body;
    
    logger.info(`Recording event for call ${callId}: ${RecordingStatus}`);
    
    if (RecordingStatus === 'completed' && RecordingUrl) {
      // Process completed recording for post-call analysis
      // This could include full transcript generation and translation
      logger.info(`Call recording completed for ${callId}: ${RecordingUrl}`);
    }
    
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');

  } catch (error) {
    logger.error(`Failed to handle recording event for call ${req.params.callId}:`, error);
    res.status(500).send('<Response></Response>');
  }
});

/**
 * POST /pstn/audio/:callId
 * Handle real-time audio streams for translation
 */
router.post('/audio/:callId', express.raw({ type: 'audio/wav' }), async (req, res) => {
  try {
    const { callId } = req.params;
    const audioBuffer = req.body;
    
    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No audio data provided'
      });
    }

    await pstnService.handleAudioStream(callId, audioBuffer);

    res.json({
      success: true,
      message: 'Audio processed'
    });

  } catch (error) {
    logger.error(`Failed to process audio for call ${req.params.callId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to process audio'
    });
  }
});

/**
 * GET /pstn/quick-dial/uscis
 * Quick dial to USCIS with user's preferred language
 */
router.post('/quick-dial/uscis', async (req, res) => {
  try {
    const { userId, fromNumber, targetLanguage = 'es' } = req.body;
    
    if (!userId || !fromNumber) {
      return res.status(400).json({
        success: false,
        error: 'User ID and phone number are required'
      });
    }

    const callOptions: PSNTCallOptions = {
      fromNumber,
      toNumber: '+18003755283', // USCIS Contact Center
      userId,
      targetLanguage,
      sourceLanguage: 'en'
    };

    const callId = await pstnService.initiateCall(callOptions);

    res.json({
      success: true,
      data: {
        callId,
        destination: 'USCIS Contact Center',
        number: '+1-800-375-5283',
        translationLanguage: targetLanguage,
        message: 'Connecting to USCIS with live translation'
      }
    });

  } catch (error) {
    logger.error('Failed to initiate USCIS quick dial:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect to USCIS',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Event listeners for real-time updates
pstnService.on('callInitiated', (data) => {
  logger.info(`Call initiated: ${data.callId}`);
  // Could emit socket.io events for real-time UI updates
});

pstnService.on('callBridged', (data) => {
  logger.info(`Call bridged: ${data.callId}`);
  // Could emit socket.io events for real-time UI updates
});

pstnService.on('callEnded', (data) => {
  logger.info(`Call ended: ${data.callId}`);
  // Could emit socket.io events for real-time UI updates
});

export default router;