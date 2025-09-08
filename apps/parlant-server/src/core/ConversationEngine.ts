import { Server, Socket } from 'socket.io';
import { ImmigrationGuidelines } from './ImmigrationGuidelines';
import { ToolRegistry } from './ToolRegistry';
import { JourneyManager } from './JourneyManager';
import { logger } from '../utils/logger';

interface Message {
  id: string;
  conversationId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  journeyId?: string;
  metadata?: any;
}

interface ConversationContext {
  userId: string;
  conversationId: string;
  currentJourney?: string;
  journeyState?: any;
  userProfile?: {
    name?: string;
    language?: string;
    caseType?: string;
    currentForms?: string[];
  };
  sessionData?: Record<string, any>;
}

export class ConversationEngine {
  private io: Server;
  private guidelines: ImmigrationGuidelines;
  private toolRegistry: ToolRegistry;
  private journeyManager: JourneyManager;
  private activeConversations: Map<string, ConversationContext> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.guidelines = new ImmigrationGuidelines();
    this.toolRegistry = new ToolRegistry();
    this.journeyManager = new JourneyManager();
    
    this.initializeTools();
    this.initializeJourneys();
  }

  private async initializeTools() {
    // Register all immigration suite tools
    await this.toolRegistry.registerTool({
      name: 'analyze_document',
      description: 'Analyze uploaded immigration documents using OCR and AI',
      endpoint: 'http://localhost:3019/api/mail/understand',
      parameters: {
        document: { type: 'file', required: true },
        analysis_type: { type: 'string', enum: ['full', 'extract', 'translate'] }
      }
    });

    await this.toolRegistry.registerTool({
      name: 'fill_form',
      description: 'Auto-fill PDF forms with extracted data',
      endpoint: 'http://localhost:3004/api/forms/fill',
      parameters: {
        form_type: { type: 'string', required: true },
        data: { type: 'object', required: true }
      }
    });

    await this.toolRegistry.registerTool({
      name: 'translate_text',
      description: 'Translate text to different languages',
      endpoint: 'http://localhost:3019/api/mail/translate',
      parameters: {
        text: { type: 'string', required: true },
        fromLanguage: { type: 'string', required: true },
        toLanguage: { type: 'string', required: true }
      }
    });

    await this.toolRegistry.registerTool({
      name: 'check_case_status',
      description: 'Check USCIS case status',
      endpoint: 'http://localhost:3002/api/status/check',
      parameters: {
        receiptNumber: { type: 'string', required: true }
      }
    });

    await this.toolRegistry.registerTool({
      name: 'schedule_appointment',
      description: 'Schedule appointments with legal services',
      endpoint: 'http://localhost:3016/api/appointments/schedule',
      parameters: {
        service_type: { type: 'string', required: true },
        preferred_date: { type: 'string', required: true },
        duration: { type: 'number', default: 60 }
      }
    });

    await this.toolRegistry.registerTool({
      name: 'process_payment',
      description: 'Process payments for services and fees',
      endpoint: 'http://localhost:3013/api/payments/process',
      parameters: {
        amount: { type: 'number', required: true },
        service: { type: 'string', required: true },
        payment_method: { type: 'string', enum: ['card', 'bank', 'check'] }
      }
    });

    await this.toolRegistry.registerTool({
      name: 'get_credential_pathways',
      description: 'Get career pathways for foreign credentials',
      endpoint: 'http://localhost:3019/api/credentials/pathways',
      parameters: {
        profession: { type: 'string', required: true },
        state: { type: 'string' }
      }
    });
  }

  private async initializeJourneys() {
    // Initialize conversation journeys
    await this.journeyManager.createJourney({
      id: 'intake_helper',
      name: 'Intake & Form Helper',
      description: 'Smart assistance for filling immigration forms',
      triggerPhrases: ['help with form', 'fill out application', 'need form help'],
      steps: [
        {
          id: 'identify_form',
          name: 'Identify Form Type',
          prompt: 'What type of immigration form do you need help with?',
          requiredTools: ['analyze_document']
        },
        {
          id: 'gather_information',
          name: 'Gather Required Information',
          prompt: 'Let me help you gather the required information for this form.',
          requiredTools: ['translate_text']
        },
        {
          id: 'fill_form',
          name: 'Fill Out Form',
          prompt: 'I\'ll now fill out your form with the provided information.',
          requiredTools: ['fill_form']
        }
      ]
    });

    await this.journeyManager.createJourney({
      id: 'mail_copilot',
      name: 'Mail Understanding Copilot',
      description: 'Analyze and understand official immigration mail',
      triggerPhrases: ['analyze document', 'understand mail', 'what does this mean'],
      steps: [
        {
          id: 'upload_document',
          name: 'Upload Document',
          prompt: 'Please upload the document you need help understanding.',
          requiredTools: ['analyze_document']
        },
        {
          id: 'analyze_content',
          name: 'Analyze Content',
          prompt: 'Let me analyze this document for you.',
          requiredTools: ['analyze_document', 'translate_text']
        },
        {
          id: 'provide_summary',
          name: 'Provide Summary',
          prompt: 'Here\'s what this document means and what you need to do.',
          requiredTools: []
        }
      ]
    });

    await this.journeyManager.createJourney({
      id: 'case_concierge',
      name: 'Case Concierge',
      description: 'Guided assistance for case management',
      triggerPhrases: ['check status', 'case help', 'what\'s next'],
      steps: [
        {
          id: 'identify_case',
          name: 'Identify Case',
          prompt: 'What\'s your USCIS receipt number?',
          requiredTools: ['check_case_status']
        },
        {
          id: 'status_check',
          name: 'Check Status',
          prompt: 'Let me check your case status.',
          requiredTools: ['check_case_status']
        },
        {
          id: 'next_steps',
          name: 'Next Steps',
          prompt: 'Based on your case status, here\'s what you should do next.',
          requiredTools: ['schedule_appointment']
        }
      ]
    });

    await this.journeyManager.createJourney({
      id: 'voice_pstn_handoff',
      name: 'Voice & PSTN Hand-off',
      description: 'Voice calls with translation support',
      triggerPhrases: ['call uscis', 'need interpreter', 'phone help'],
      steps: [
        {
          id: 'prepare_call',
          name: 'Prepare Call',
          prompt: 'I\'ll help you prepare for your call. What do you need to discuss?',
          requiredTools: []
        },
        {
          id: 'initiate_call',
          name: 'Initiate Call',
          prompt: 'Connecting you with translation support...',
          requiredTools: ['translate_text']
        }
      ]
    });

    await this.journeyManager.createJourney({
      id: 'billing_nudges',
      name: 'Billing Nudges',
      description: 'Payment reminders and assistance',
      triggerPhrases: ['payment due', 'pay fee', 'billing help'],
      steps: [
        {
          id: 'identify_payment',
          name: 'Identify Payment',
          prompt: 'What payment do you need help with?',
          requiredTools: []
        },
        {
          id: 'process_payment',
          name: 'Process Payment',
          prompt: 'Let me help you process this payment.',
          requiredTools: ['process_payment']
        }
      ]
    });
  }

  async handleSocketConnection(socket: Socket, conversationId: string) {
    try {
      const context = this.getOrCreateContext(socket, conversationId);
      
      // Send welcome message with available journeys
      const availableJourneys = await this.journeyManager.getAvailableJourneys();
      
      socket.emit('conversation-ready', {
        conversationId,
        availableJourneys,
        guidelines: await this.guidelines.getContextualGuidelines(context)
      });

      logger.info(`Conversation ${conversationId} ready for user ${context.userId}`);
    } catch (error) {
      logger.error('Error handling socket connection:', error);
      socket.emit('error', { message: 'Failed to initialize conversation' });
    }
  }

  async handleMessage(socket: Socket, data: any) {
    try {
      const { conversationId, content, journeyId } = data;
      const context = this.activeConversations.get(conversationId);
      
      if (!context) {
        throw new Error('Conversation context not found');
      }

      // Create message record
      const message: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        conversationId,
        content,
        role: 'user',
        timestamp: new Date(),
        journeyId
      };

      // Process message based on current journey
      let response;
      
      if (context.currentJourney) {
        response = await this.journeyManager.processJourneyMessage(
          context.currentJourney,
          message,
          context
        );
      } else {
        // Determine appropriate journey based on message content
        const suggestedJourney = await this.journeyManager.suggestJourney(content);
        
        if (suggestedJourney) {
          context.currentJourney = suggestedJourney.id;
          response = await this.journeyManager.startJourney(
            suggestedJourney.id,
            message,
            context
          );
        } else {
          // General conversation with guidelines
          response = await this.processGeneralMessage(message, context);
        }
      }

      // Send response
      socket.emit('message', {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        conversationId,
        content: response.content,
        role: 'assistant',
        timestamp: new Date(),
        metadata: response.metadata,
        suggestedActions: response.suggestedActions
      });

      // Broadcast to room if needed
      socket.to(conversationId).emit('message', response);

    } catch (error) {
      logger.error('Error handling message:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  }

  private getOrCreateContext(socket: Socket, conversationId: string): ConversationContext {
    let context = this.activeConversations.get(conversationId);
    
    if (!context) {
      context = {
        userId: socket.handshake.auth?.userId || socket.id,
        conversationId,
        sessionData: {}
      };
      this.activeConversations.set(conversationId, context);
    }
    
    return context;
  }

  private async processGeneralMessage(message: Message, context: ConversationContext) {
    // Apply immigration guidelines to general conversation
    const guidelines = await this.guidelines.getContextualGuidelines(context);
    const glossaryTerms = await this.guidelines.getRelevantGlossaryTerms(message.content);

    // Generate response following guidelines
    const response = await this.generateGuidelineBasedResponse(
      message.content,
      guidelines,
      glossaryTerms,
      context
    );

    return {
      content: response,
      metadata: {
        guidelines_applied: guidelines.map(g => g.id),
        glossary_terms: glossaryTerms
      },
      suggestedActions: await this.getSuggestedActions(message.content, context)
    };
  }

  private async generateGuidelineBasedResponse(
    userMessage: string,
    guidelines: any[],
    glossaryTerms: any[],
    context: ConversationContext
  ): Promise<string> {
    // This would integrate with your LLM of choice (Anthropic, OpenAI, etc.)
    // For now, returning a structured response based on guidelines
    
    const guidancePoints = guidelines.map(g => g.guidance).join(' ');
    const relevantTerms = glossaryTerms.map(t => `${t.term}: ${t.definition}`).join(' ');
    
    return `Based on immigration law and USCIS guidelines: ${guidancePoints} ${relevantTerms} 

How can I help you specifically with your immigration matter?`;
  }

  private async getSuggestedActions(userMessage: string, context: ConversationContext) {
    const actions = [];
    
    // Analyze message for suggested actions
    if (userMessage.toLowerCase().includes('form')) {
      actions.push({
        type: 'start_journey',
        label: 'Get Form Help',
        journeyId: 'intake_helper'
      });
    }
    
    if (userMessage.toLowerCase().includes('document') || userMessage.toLowerCase().includes('mail')) {
      actions.push({
        type: 'start_journey',
        label: 'Analyze Document',
        journeyId: 'mail_copilot'
      });
    }
    
    if (userMessage.toLowerCase().includes('status') || userMessage.toLowerCase().includes('case')) {
      actions.push({
        type: 'start_journey',
        label: 'Check Case Status',
        journeyId: 'case_concierge'
      });
    }

    return actions;
  }

  async getConversationHistory(conversationId: string): Promise<Message[]> {
    // This would typically fetch from database
    // For now, returning empty array
    return [];
  }

  async saveMessage(message: Message): Promise<void> {
    // This would typically save to database
    logger.info(`Saving message: ${message.id}`);
  }
}