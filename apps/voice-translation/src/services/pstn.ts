import Twilio from 'twilio';
import { EventEmitter } from 'events';
import { TranslationService } from './translation';
import { logger } from '../utils/logger';

export interface PSNTCallOptions {
  fromNumber: string;
  toNumber: string;
  userId: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface ActiveCall {
  id: string;
  userId: string;
  fromNumber: string;
  toNumber: string;
  targetLanguage: string;
  sourceLanguage: string;
  status: 'connecting' | 'active' | 'ended';
  startTime: Date;
  callSid?: string;
  conferenceName?: string;
}

export class PSNTBridgeService extends EventEmitter {
  private twilioClient: Twilio.Twilio;
  private translationService: TranslationService;
  private activeCalls: Map<string, ActiveCall> = new Map();
  private callAudioBuffers: Map<string, Buffer[]> = new Map();

  constructor() {
    super();
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }
    
    this.twilioClient = Twilio(accountSid, authToken);
    this.translationService = new TranslationService();
  }

  /**
   * Initiate a PSTN call with live translation
   */
  async initiateCall(options: PSNTCallOptions): Promise<string> {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info(`Initiating PSTN call ${callId} from ${options.fromNumber} to ${options.toNumber}`);
      
      // Create conference for 3-way call (user, destination, translation bridge)
      const conferenceName = `translate_conf_${callId}`;
      
      // Call the user first
      const userCall = await this.twilioClient.calls.create({
        from: process.env.TWILIO_FROM_NUMBER!,
        to: options.fromNumber,
        twiml: this.generateUserTwiML(conferenceName, callId),
        statusCallback: `${process.env.BASE_URL}/pstn/status/${callId}`,
        statusCallbackEvent: ['initiated', 'answered', 'completed'],
        record: true
      });

      // Create active call record
      const activeCall: ActiveCall = {
        id: callId,
        userId: options.userId,
        fromNumber: options.fromNumber,
        toNumber: options.toNumber,
        targetLanguage: options.targetLanguage,
        sourceLanguage: options.sourceLanguage || 'en',
        status: 'connecting',
        startTime: new Date(),
        callSid: userCall.sid,
        conferenceName
      };

      this.activeCalls.set(callId, activeCall);
      this.callAudioBuffers.set(callId, []);

      // After user joins, call the destination
      setTimeout(async () => {
        if (this.activeCalls.get(callId)?.status === 'active') {
          await this.callDestination(callId, options.toNumber, conferenceName);
        }
      }, 3000);

      this.emit('callInitiated', { callId, activeCall });
      return callId;
      
    } catch (error) {
      logger.error(`Failed to initiate PSTN call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Bridge an active call with translation
   */
  async bridgeCall(callId: string): Promise<void> {
    const activeCall = this.activeCalls.get(callId);
    if (!activeCall) {
      throw new Error(`Call ${callId} not found`);
    }

    try {
      logger.info(`Bridging call ${callId} with translation`);
      
      // Start real-time translation stream
      await this.setupTranslationStream(callId);
      
      activeCall.status = 'active';
      this.activeCalls.set(callId, activeCall);
      
      this.emit('callBridged', { callId, activeCall });
      
    } catch (error) {
      logger.error(`Failed to bridge call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * End an active call
   */
  async endCall(callId: string): Promise<void> {
    const activeCall = this.activeCalls.get(callId);
    if (!activeCall) {
      throw new Error(`Call ${callId} not found`);
    }

    try {
      logger.info(`Ending call ${callId}`);
      
      // Hang up all participants in the conference
      if (activeCall.conferenceName) {
        const conference = await this.twilioClient.conferences(activeCall.conferenceName).fetch();
        const participants = await this.twilioClient.conferences(activeCall.conferenceName).participants.list();
        
        for (const participant of participants) {
          await this.twilioClient.conferences(activeCall.conferenceName)
            .participants(participant.callSid)
            .update({ muted: true })
            .then(() => 
              this.twilioClient.conferences(activeCall.conferenceName!)
                .participants(participant.callSid)
                .remove()
            );
        }
      }

      // Update call status
      activeCall.status = 'ended';
      this.activeCalls.set(callId, activeCall);
      
      // Cleanup
      this.callAudioBuffers.delete(callId);
      
      this.emit('callEnded', { callId, activeCall });
      
    } catch (error) {
      logger.error(`Failed to end call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Get active call information
   */
  getActiveCall(callId: string): ActiveCall | undefined {
    return this.activeCalls.get(callId);
  }

  /**
   * List all active calls for a user
   */
  getUserActiveCalls(userId: string): ActiveCall[] {
    return Array.from(this.activeCalls.values()).filter(call => 
      call.userId === userId && call.status === 'active'
    );
  }

  /**
   * Handle call status updates from Twilio
   */
  handleCallStatus(callId: string, status: string, callSid: string): void {
    const activeCall = this.activeCalls.get(callId);
    if (!activeCall) return;

    logger.info(`Call ${callId} status update: ${status}`);

    switch (status) {
      case 'answered':
        activeCall.status = 'active';
        break;
      case 'completed':
      case 'busy':
      case 'no-answer':
      case 'failed':
        activeCall.status = 'ended';
        break;
    }

    this.activeCalls.set(callId, activeCall);
    this.emit('callStatusChanged', { callId, status, activeCall });
  }

  /**
   * Handle incoming audio streams for translation
   */
  async handleAudioStream(callId: string, audioBuffer: Buffer): Promise<void> {
    const activeCall = this.activeCalls.get(callId);
    if (!activeCall || activeCall.status !== 'active') return;

    try {
      // Buffer audio for processing
      const buffers = this.callAudioBuffers.get(callId) || [];
      buffers.push(audioBuffer);
      this.callAudioBuffers.set(callId, buffers);

      // Process translation when we have enough audio (e.g., 3 seconds)
      if (buffers.length >= 30) { // Assuming 100ms chunks
        const combinedAudio = Buffer.concat(buffers);
        this.callAudioBuffers.set(callId, []); // Clear buffer

        // Perform real-time translation
        const translatedText = await this.translationService.translateAudio(
          combinedAudio,
          activeCall.sourceLanguage,
          activeCall.targetLanguage
        );

        if (translatedText) {
          // Convert translated text to speech and play in conference
          await this.playTranslatedAudio(activeCall.conferenceName!, translatedText, activeCall.targetLanguage);
        }
      }
    } catch (error) {
      logger.error(`Error processing audio for call ${callId}:`, error);
    }
  }

  private async callDestination(callId: string, toNumber: string, conferenceName: string): Promise<void> {
    try {
      await this.twilioClient.calls.create({
        from: process.env.TWILIO_FROM_NUMBER!,
        to: toNumber,
        twiml: this.generateDestinationTwiML(conferenceName),
        statusCallback: `${process.env.BASE_URL}/pstn/status/${callId}`,
      });
      
      logger.info(`Called destination ${toNumber} for conference ${conferenceName}`);
    } catch (error) {
      logger.error(`Failed to call destination ${toNumber}:`, error);
    }
  }

  private generateUserTwiML(conferenceName: string, callId: string): string {
    return `
      <Response>
        <Say voice="alice">Connecting you to your translated call. Please wait.</Say>
        <Dial>
          <Conference 
            startConferenceOnEnter="true" 
            endConferenceOnExit="false"
            statusCallback="${process.env.BASE_URL}/pstn/conference/${callId}"
            statusCallbackEvent="start join leave end mute hold"
            record="record-from-start"
            recordingStatusCallback="${process.env.BASE_URL}/pstn/recording/${callId}">
            ${conferenceName}
          </Conference>
        </Dial>
      </Response>
    `;
  }

  private generateDestinationTwiML(conferenceName: string): string {
    return `
      <Response>
        <Dial>
          <Conference startConferenceOnEnter="false" endConferenceOnExit="true">
            ${conferenceName}
          </Conference>
        </Dial>
      </Response>
    `;
  }

  private async setupTranslationStream(callId: string): Promise<void> {
    // This would integrate with your existing real-time translation service
    // For now, we'll set up the framework for processing
    logger.info(`Setting up translation stream for call ${callId}`);
    
    // Initialize translation stream handlers
    // This would connect to your existing LiveKit or WebSocket translation infrastructure
  }

  private async playTranslatedAudio(conferenceName: string, text: string, language: string): Promise<void> {
    try {
      // Generate TTS audio for the translated text
      const audioUrl = await this.translationService.generateSpeech(text, language);
      
      // Play the audio in the conference
      await this.twilioClient.conferences(conferenceName)
        .recordings
        .create({
          recordingChannels: 'dual',
          recordingStatusCallback: `${process.env.BASE_URL}/pstn/playback-complete`
        });
    } catch (error) {
      logger.error(`Failed to play translated audio in conference ${conferenceName}:`, error);
    }
  }
}