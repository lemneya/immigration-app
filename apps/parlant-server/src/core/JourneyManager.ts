import { ToolRegistry } from './ToolRegistry';
import { logger } from '../utils/logger';

interface Journey {
  id: string;
  name: string;
  description: string;
  triggerPhrases: string[];
  steps: JourneyStep[];
  metadata?: {
    category: string;
    estimatedDuration?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    requirements?: string[];
  };
}

interface JourneyStep {
  id: string;
  name: string;
  prompt: string;
  requiredTools: string[];
  conditions?: {
    skipIf?: string;
    requireIf?: string;
  };
  validation?: {
    required: string[];
    format?: Record<string, string>;
  };
}

interface JourneyState {
  journeyId: string;
  currentStep: number;
  stepData: Record<string, any>;
  completedSteps: string[];
  context: Record<string, any>;
  startedAt: Date;
  lastUpdated: Date;
}

export class JourneyManager {
  private journeys: Map<string, Journey> = new Map();
  private toolRegistry?: ToolRegistry;

  constructor(toolRegistry?: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  async createJourney(journey: Journey): Promise<void> {
    this.validateJourney(journey);
    this.journeys.set(journey.id, journey);
    logger.info(`Created journey: ${journey.id}`);
  }

  async suggestJourney(userMessage: string): Promise<Journey | null> {
    const lowerMessage = userMessage.toLowerCase();
    
    for (const journey of this.journeys.values()) {
      const isTriggered = journey.triggerPhrases.some(trigger => 
        lowerMessage.includes(trigger.toLowerCase())
      );
      
      if (isTriggered) {
        logger.info(`Suggested journey: ${journey.id} for message: ${userMessage}`);
        return journey;
      }
    }
    
    return null;
  }

  async startJourney(journeyId: string, initialMessage: any, context: any): Promise<any> {
    const journey = this.journeys.get(journeyId);
    if (!journey) {
      throw new Error(`Journey ${journeyId} not found`);
    }

    const journeyState: JourneyState = {
      journeyId,
      currentStep: 0,
      stepData: {},
      completedSteps: [],
      context: { ...context.sessionData },
      startedAt: new Date(),
      lastUpdated: new Date()
    };

    // Update context
    context.currentJourney = journeyId;
    context.journeyState = journeyState;

    // Get first step
    const firstStep = journey.steps[0];
    
    return {
      content: `I'll help you with ${journey.name}. ${firstStep.prompt}`,
      metadata: {
        journeyId,
        stepId: firstStep.id,
        stepNumber: 1,
        totalSteps: journey.steps.length,
        requiredTools: firstStep.requiredTools
      },
      suggestedActions: await this.getStepActions(firstStep, journeyState)
    };
  }

  async processJourneyMessage(journeyId: string, message: any, context: any): Promise<any> {
    const journey = this.journeys.get(journeyId);
    const journeyState = context.journeyState as JourneyState;

    if (!journey || !journeyState) {
      throw new Error('Journey or state not found');
    }

    const currentStep = journey.steps[journeyState.currentStep];
    if (!currentStep) {
      return this.completeJourney(journey, journeyState, context);
    }

    // Process the current step
    const stepResult = await this.processStep(currentStep, message, journeyState, context);
    
    if (stepResult.completed) {
      // Mark step as completed
      journeyState.completedSteps.push(currentStep.id);
      journeyState.stepData[currentStep.id] = stepResult.data;
      journeyState.currentStep++;
      journeyState.lastUpdated = new Date();

      // Check if journey is complete
      if (journeyState.currentStep >= journey.steps.length) {
        return this.completeJourney(journey, journeyState, context);
      }

      // Move to next step
      const nextStep = journey.steps[journeyState.currentStep];
      return {
        content: `Great! ${stepResult.message} Now, ${nextStep.prompt}`,
        metadata: {
          journeyId,
          stepId: nextStep.id,
          stepNumber: journeyState.currentStep + 1,
          totalSteps: journey.steps.length,
          requiredTools: nextStep.requiredTools,
          previousStepData: stepResult.data
        },
        suggestedActions: await this.getStepActions(nextStep, journeyState)
      };
    } else {
      // Stay on current step, provide guidance
      return {
        content: stepResult.message || `I need more information for this step. ${currentStep.prompt}`,
        metadata: {
          journeyId,
          stepId: currentStep.id,
          stepNumber: journeyState.currentStep + 1,
          totalSteps: journey.steps.length,
          requiredTools: currentStep.requiredTools,
          validation: stepResult.validation
        },
        suggestedActions: await this.getStepActions(currentStep, journeyState)
      };
    }
  }

  private async processStep(step: JourneyStep, message: any, state: JourneyState, context: any): Promise<{
    completed: boolean;
    data?: any;
    message?: string;
    validation?: any;
  }> {
    switch (step.id) {
      case 'identify_form':
        return this.processFormIdentification(message, state, context);
      
      case 'gather_information':
        return this.processInformationGathering(message, state, context);
      
      case 'fill_form':
        return this.processFormFilling(message, state, context);
      
      case 'upload_document':
        return this.processDocumentUpload(message, state, context);
      
      case 'analyze_content':
        return this.processContentAnalysis(message, state, context);
      
      case 'provide_summary':
        return this.processDocumentSummary(message, state, context);
      
      case 'identify_case':
        return this.processCaseIdentification(message, state, context);
      
      case 'status_check':
        return this.processStatusCheck(message, state, context);
      
      case 'next_steps':
        return this.processNextSteps(message, state, context);
      
      case 'prepare_call':
        return this.processCallPreparation(message, state, context);
      
      case 'initiate_call':
        return this.processCallInitiation(message, state, context);
      
      case 'identify_payment':
        return this.processPaymentIdentification(message, state, context);
      
      case 'process_payment':
        return this.processPaymentProcessing(message, state, context);
      
      default:
        return this.processGenericStep(step, message, state, context);
    }
  }

  private async processFormIdentification(message: any, state: JourneyState, context: any) {
    const content = message.content.toLowerCase();
    const formTypes = {
      'i-485': 'Adjustment of Status',
      'i-130': 'Family-Based Immigration',
      'i-131': 'Travel Document',
      'i-765': 'Work Authorization',
      'n-400': 'Naturalization',
      'i-90': 'Green Card Renewal'
    };

    for (const [form, description] of Object.entries(formTypes)) {
      if (content.includes(form) || content.includes(description.toLowerCase())) {
        return {
          completed: true,
          data: { formType: form, description },
          message: `I'll help you with Form ${form} (${description}).`
        };
      }
    }

    return {
      completed: false,
      message: 'Could you specify which form you need help with? For example: I-485, I-130, N-400, etc.'
    };
  }

  private async processInformationGathering(message: any, state: JourneyState, context: any) {
    // This would collect required information based on the form type
    const requiredFields = this.getRequiredFields(state.stepData.identify_form?.formType);
    const providedInfo = this.extractInformation(message.content);

    const missingFields = requiredFields.filter(field => !providedInfo[field]);
    
    if (missingFields.length === 0) {
      return {
        completed: true,
        data: providedInfo,
        message: 'Perfect! I have all the information needed to fill out your form.'
      };
    }

    return {
      completed: false,
      message: `I still need the following information: ${missingFields.join(', ')}`
    };
  }

  private async processFormFilling(message: any, state: JourneyState, context: any) {
    if (!this.toolRegistry) {
      return {
        completed: false,
        message: 'Tool registry not available for form filling.'
      };
    }

    try {
      const formData = state.stepData.gather_information;
      const formType = state.stepData.identify_form?.formType;

      const result = await this.toolRegistry.callTool({
        tool: 'fill_form',
        parameters: {
          form_type: formType,
          data: formData
        }
      });

      if (result.success) {
        return {
          completed: true,
          data: result.data,
          message: 'Your form has been filled out successfully! Please review it carefully before submitting.'
        };
      } else {
        return {
          completed: false,
          message: `There was an issue filling out the form: ${result.error}`
        };
      }
    } catch (error) {
      return {
        completed: false,
        message: 'An error occurred while filling out the form. Please try again.'
      };
    }
  }

  private async processDocumentUpload(message: any, state: JourneyState, context: any) {
    // Check if message contains file attachment
    if (message.attachments && message.attachments.length > 0) {
      return {
        completed: true,
        data: { document: message.attachments[0] },
        message: 'Document uploaded successfully! Let me analyze it for you.'
      };
    }

    return {
      completed: false,
      message: 'Please upload the document you need help with.'
    };
  }

  private async processContentAnalysis(message: any, state: JourneyState, context: any) {
    if (!this.toolRegistry) {
      return {
        completed: false,
        message: 'Tool registry not available for document analysis.'
      };
    }

    try {
      const document = state.stepData.upload_document?.document;
      
      const result = await this.toolRegistry.orchestrateImmigrationWorkflow(
        'document_analysis_workflow',
        { 
          document,
          needsTranslation: true 
        }
      );

      return {
        completed: true,
        data: result,
        message: 'Document analysis complete! Let me summarize what this document means.'
      };
    } catch (error) {
      return {
        completed: false,
        message: 'Failed to analyze the document. Please try again.'
      };
    }
  }

  private async processDocumentSummary(message: any, state: JourneyState, context: any) {
    const analysisResult = state.stepData.analyze_content;
    
    if (analysisResult) {
      const summary = this.generateDocumentSummary(analysisResult);
      return {
        completed: true,
        data: { summary },
        message: summary
      };
    }

    return {
      completed: false,
      message: 'No analysis data available to summarize.'
    };
  }

  private async processCaseIdentification(message: any, state: JourneyState, context: any) {
    const receiptMatch = message.content.match(/[A-Z]{3}\d{10}/);
    
    if (receiptMatch) {
      return {
        completed: true,
        data: { receiptNumber: receiptMatch[0] },
        message: `I found your receipt number: ${receiptMatch[0]}. Let me check your case status.`
      };
    }

    return {
      completed: false,
      message: 'Please provide your 13-character USCIS receipt number (like MSC2190000001).'
    };
  }

  private async processStatusCheck(message: any, state: JourneyState, context: any) {
    if (!this.toolRegistry) {
      return {
        completed: false,
        message: 'Tool registry not available for status checking.'
      };
    }

    try {
      const receiptNumber = state.stepData.identify_case?.receiptNumber;
      
      const result = await this.toolRegistry.orchestrateImmigrationWorkflow(
        'case_status_workflow',
        { receiptNumber }
      );

      return {
        completed: true,
        data: result,
        message: `Your case status: ${result.status.status}. ${result.status.details || ''}`
      };
    } catch (error) {
      return {
        completed: false,
        message: 'Unable to check case status at this time. Please try again later.'
      };
    }
  }

  private async processNextSteps(message: any, state: JourneyState, context: any) {
    const statusData = state.stepData.status_check;
    const suggestions = statusData?.suggestions || [];
    
    const nextStepsMessage = suggestions.length > 0 
      ? `Based on your case status, here are your next steps:\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : 'Your case is progressing normally. Continue to monitor your status for updates.';

    return {
      completed: true,
      data: { suggestions },
      message: nextStepsMessage
    };
  }

  private async processGenericStep(step: JourneyStep, message: any, state: JourneyState, context: any) {
    // Generic step processing - mark as completed if user provides any response
    return {
      completed: true,
      data: { response: message.content },
      message: 'Thank you for the information. Moving to the next step.'
    };
  }

  // Placeholder methods for other step types
  private async processCallPreparation(message: any, state: JourneyState, context: any) {
    return { completed: true, data: { topic: message.content }, message: 'Call preparation complete.' };
  }

  private async processCallInitiation(message: any, state: JourneyState, context: any) {
    return { completed: true, data: {}, message: 'Call initiated with translation support.' };
  }

  private async processPaymentIdentification(message: any, state: JourneyState, context: any) {
    return { completed: true, data: { paymentType: message.content }, message: 'Payment identified.' };
  }

  private async processPaymentProcessing(message: any, state: JourneyState, context: any) {
    return { completed: true, data: {}, message: 'Payment processed successfully.' };
  }

  private getRequiredFields(formType: string): string[] {
    const fieldMap: Record<string, string[]> = {
      'i-485': ['full_name', 'date_of_birth', 'country_of_birth', 'address'],
      'i-130': ['petitioner_name', 'beneficiary_name', 'relationship'],
      'n-400': ['full_name', 'address', 'green_card_date']
    };
    
    return fieldMap[formType] || ['full_name', 'date_of_birth'];
  }

  private extractInformation(content: string): Record<string, any> {
    // Simple information extraction - this would be more sophisticated in production
    const info: Record<string, any> = {};
    
    // Extract name patterns
    const nameMatch = content.match(/(?:name|called|i'm|i am)\s+(.+)/i);
    if (nameMatch) info.full_name = nameMatch[1].trim();
    
    // Extract dates
    const dateMatch = content.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch) info.date_of_birth = dateMatch[1];
    
    return info;
  }

  private generateDocumentSummary(analysisResult: any): string {
    const analysis = analysisResult.analysis;
    const translation = analysisResult.translation;
    
    let summary = `This document appears to be ${analysis.documentType || 'an official document'}. `;
    
    if (analysis.keyInformation) {
      summary += `Key information: ${analysis.keyInformation}. `;
    }
    
    if (analysis.actionRequired) {
      summary += `Action required: ${analysis.actionRequired}. `;
    }
    
    if (translation) {
      summary += `This document was translated from ${translation.fromLanguage} to English.`;
    }
    
    return summary;
  }

  private async getStepActions(step: JourneyStep, state: JourneyState): Promise<any[]> {
    const actions = [];
    
    // Add tool-specific actions
    if (step.requiredTools.includes('analyze_document')) {
      actions.push({
        type: 'upload_file',
        label: 'Upload Document',
        accept: '.pdf,.jpg,.png,.doc,.docx'
      });
    }
    
    if (step.requiredTools.includes('fill_form')) {
      actions.push({
        type: 'start_form',
        label: 'Start Form Filling'
      });
    }
    
    return actions;
  }

  private validateJourney(journey: Journey): void {
    if (!journey.id || !journey.name || !journey.steps) {
      throw new Error('Journey must have id, name, and steps');
    }
    
    if (journey.steps.length === 0) {
      throw new Error('Journey must have at least one step');
    }
    
    // Validate steps
    journey.steps.forEach((step, index) => {
      if (!step.id || !step.name || !step.prompt) {
        throw new Error(`Step ${index + 1} must have id, name, and prompt`);
      }
    });
  }

  private async completeJourney(journey: Journey, state: JourneyState, context: any): Promise<any> {
    context.currentJourney = null;
    context.journeyState = null;
    
    logger.info(`Completed journey: ${journey.id}`);
    
    return {
      content: `Great! We've completed your ${journey.name}. Is there anything else I can help you with?`,
      metadata: {
        journeyCompleted: true,
        journeyId: journey.id,
        totalSteps: journey.steps.length,
        completedAt: new Date(),
        duration: Date.now() - state.startedAt.getTime()
      },
      suggestedActions: [
        {
          type: 'start_new_journey',
          label: 'Start Another Task'
        }
      ]
    };
  }

  async getAvailableJourneys(): Promise<Journey[]> {
    return Array.from(this.journeys.values());
  }

  async getJourney(id: string): Promise<Journey | undefined> {
    return this.journeys.get(id);
  }

  async updateJourney(id: string, updates: Partial<Journey>): Promise<boolean> {
    const existing = this.journeys.get(id);
    if (!existing) return false;
    
    const updated = { ...existing, ...updates };
    this.validateJourney(updated);
    
    this.journeys.set(id, updated);
    logger.info(`Updated journey: ${id}`);
    return true;
  }

  async deleteJourney(id: string): Promise<boolean> {
    const removed = this.journeys.delete(id);
    if (removed) {
      logger.info(`Deleted journey: ${id}`);
    }
    return removed;
  }
}