/**
 * Information Extraction Service
 * Extracts structured data and actionable items from documents using regex + NLP
 */

import { format, parse, isValid } from 'date-fns';
import nlp from 'compromise';
import { logger } from '../utils/logger';

import type {
  ExtractedInfo,
  ActionExtraction,
  ActionType,
  DocumentType
} from '../models/types';

export class ExtractionService {
  
  /**
   * Extract structured information from document text
   */
  async extractInformation(text: string, docType: DocumentType): Promise<ExtractedInfo> {
    try {
      const info: ExtractedInfo = {};
      
      // Extract sender information
      info.sender = this.extractSenderInfo(text, docType);
      
      // Extract recipient information  
      info.recipient = this.extractRecipientInfo(text);
      
      // Extract dates
      info.dates = this.extractDates(text, docType);
      
      // Extract amounts
      info.amounts = this.extractAmounts(text, docType);
      
      // Extract identifiers (case numbers, account numbers, etc.)
      info.identifiers = this.extractIdentifiers(text, docType);
      
      // Extract instructions and actions
      info.instructions = this.extractInstructions(text);
      info.required_actions = this.extractRequiredActions(text, docType);
      
      // Extract mentioned attachments
      info.attachments_mentioned = this.extractAttachments(text);
      
      return info;
      
    } catch (error) {
      logger.error('Information extraction failed:', error);
      return {};
    }
  }

  /**
   * Extract actionable items from document
   */
  async extractActions(text: string, extractedInfo: ExtractedInfo, docType: DocumentType): Promise<ActionExtraction> {
    try {
      const actions = [];
      const textLower = text.toLowerCase();

      // Document type specific action extraction
      switch (docType) {
        case 'uscis_notice':
          actions.push(...this.extractUSCISActions(text, extractedInfo));
          break;
          
        case 'insurance_notice':
          actions.push(...this.extractInsuranceActions(text, extractedInfo));
          break;
          
        case 'credit_card_notice':
        case 'bank_statement':
          actions.push(...this.extractFinancialActions(text, extractedInfo));
          break;
          
        case 'utility_bill':
          actions.push(...this.extractUtilityActions(text, extractedInfo));
          break;
          
        case 'tax_document':
          actions.push(...this.extractTaxActions(text, extractedInfo));
          break;
          
        case 'legal_notice':
          actions.push(...this.extractLegalActions(text, extractedInfo));
          break;
      }

      // General action patterns
      actions.push(...this.extractGeneralActions(text, extractedInfo));
      
      // Determine deadline urgency
      const deadlineUrgency = this.calculateDeadlineUrgency(extractedInfo.dates?.due_date);
      
      return {
        actions: actions.slice(0, 10), // Limit to 10 actions
        deadline_urgency: deadlineUrgency
      };
      
    } catch (error) {
      logger.error('Action extraction failed:', error);
      return { actions: [], deadline_urgency: 'safe' };
    }
  }

  /**
   * Extract sender information
   */
  private extractSenderInfo(text: string, docType: DocumentType): ExtractedInfo['sender'] {
    const sender: ExtractedInfo['sender'] = {};
    
    // Organization patterns
    const orgPatterns = [
      /(?:from|sender):\s*([A-Z][^,\n]+(?:Inc|LLC|Corp|Company|Services|Department|Agency|Office|Bank|Credit Union))/i,
      /(U\.S\. Citizenship and Immigration Services|USCIS)/i,
      /([A-Z][^,\n]+(?:Insurance|Bank|Credit|Utility|Electric|Gas|Water|Healthcare|Medical))/i
    ];

    for (const pattern of orgPatterns) {
      const match = text.match(pattern);
      if (match) {
        sender.organization = match[1].trim();
        break;
      }
    }

    // Phone number
    const phoneMatch = text.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
    if (phoneMatch) {
      sender.phone = phoneMatch[1];
    }

    // Email
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      sender.email = emailMatch[1];
    }

    // Address patterns
    const addressMatch = text.match(/(\d+\s+[A-Z][^,\n]*,\s*[A-Z][^,\n]*,\s*[A-Z]{2}\s+\d{5})/i);
    if (addressMatch) {
      sender.address = addressMatch[1].trim();
    }

    // Determine if sender appears official
    sender.official = this.isOfficialSender(sender.organization || '', docType);

    return Object.keys(sender).length > 0 ? sender : undefined;
  }

  /**
   * Extract recipient information
   */
  private extractRecipientInfo(text: string): ExtractedInfo['recipient'] {
    const recipient: ExtractedInfo['recipient'] = {};
    
    // Look for "To:" or "Dear" patterns
    const nameMatch = text.match(/(?:to|dear|recipient):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    if (nameMatch) {
      recipient.name = nameMatch[1].trim();
    }

    return Object.keys(recipient).length > 0 ? recipient : undefined;
  }

  /**
   * Extract dates from text
   */
  private extractDates(text: string, docType: DocumentType): ExtractedInfo['dates'] {
    const dates: ExtractedInfo['dates'] = {};
    
    // Common date patterns
    const datePatterns = [
      // MM/DD/YYYY or MM-DD-YYYY
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,
      // Month DD, YYYY
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
      // DD Month YYYY
      /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi
    ];

    const foundDates = [];
    
    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let dateStr = match[0];
        let parsedDate;
        
        try {
          // Handle different date formats
          if (match[0].includes('/') || match[0].includes('-')) {
            parsedDate = parse(dateStr, 'M/d/yyyy', new Date());
            if (!isValid(parsedDate)) {
              parsedDate = parse(dateStr, 'MM/dd/yyyy', new Date());
            }
          } else {
            parsedDate = parse(dateStr, 'MMMM d, yyyy', new Date());
            if (!isValid(parsedDate)) {
              parsedDate = parse(dateStr, 'd MMMM yyyy', new Date());
            }
          }
          
          if (isValid(parsedDate)) {
            foundDates.push({
              date: parsedDate,
              context: this.getDateContext(text, match.index || 0),
              position: match.index || 0
            });
          }
        } catch (error) {
          continue;
        }
      }
    }

    // Sort dates by position in text
    foundDates.sort((a, b) => a.position - b.position);

    // Assign dates based on context and document type
    for (const dateInfo of foundDates) {
      const context = dateInfo.context.toLowerCase();
      
      if (context.includes('due') || context.includes('pay by') || context.includes('deadline')) {
        dates.due_date = dateInfo.date;
      } else if (context.includes('appointment') || context.includes('biometric') || context.includes('interview')) {
        dates.appointment_date = dateInfo.date;
      } else if (context.includes('effective') || context.includes('start')) {
        dates.effective_date = dateInfo.date;
      } else if (!dates.document_date) {
        // First date often represents document date
        dates.document_date = dateInfo.date;
      }
    }

    return Object.keys(dates).length > 0 ? dates : undefined;
  }

  /**
   * Extract amounts from text
   */
  private extractAmounts(text: string, docType: DocumentType): ExtractedInfo['amounts'] {
    const amounts: ExtractedInfo['amounts'] = {};
    
    // Currency patterns
    const amountPatterns = [
      // $1,234.56
      /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
      // USD 1234.56
      /USD\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
      // 1234.56 USD
      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s?USD/gi
    ];

    const foundAmounts = [];
    
    for (const pattern of amountPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const amountStr = match[1];
        const amount = parseFloat(amountStr.replace(/,/g, ''));
        
        if (!isNaN(amount) && amount > 0) {
          foundAmounts.push({
            amount,
            context: this.getAmountContext(text, match.index || 0),
            position: match.index || 0
          });
        }
      }
    }

    // Assign amounts based on context
    for (const amountInfo of foundAmounts) {
      const context = amountInfo.context.toLowerCase();
      
      if (context.includes('due') || context.includes('owe') || context.includes('balance')) {
        amounts.total_due = amountInfo.amount;
      } else if (context.includes('minimum') || context.includes('min payment')) {
        amounts.minimum_payment = amountInfo.amount;
      } else if (context.includes('balance') || context.includes('current balance')) {
        amounts.balance = amountInfo.amount;
      } else if (!amounts.total_due) {
        // First amount often represents total due
        amounts.total_due = amountInfo.amount;
      }
    }

    amounts.currency = 'USD'; // Default to USD

    return Object.keys(amounts).length > 1 ? amounts : undefined;
  }

  /**
   * Extract identifiers (case numbers, account numbers, etc.)
   */
  private extractIdentifiers(text: string, docType: DocumentType): ExtractedInfo['identifiers'] {
    const identifiers: ExtractedInfo['identifiers'] = {};
    
    // Document type specific patterns
    switch (docType) {
      case 'uscis_notice':
        // Receipt numbers (MSC, EAC, WAC, etc.)
        const receiptMatch = text.match(/(?:receipt\s+number|case\s+number):\s*([A-Z]{3}\d{10})/i);
        if (receiptMatch) {
          identifiers.receipt_number = receiptMatch[1];
          identifiers.case_number = receiptMatch[1];
        }
        break;
        
      case 'bank_statement':
      case 'credit_card_notice':
        // Account numbers (masked or full)
        const accountMatch = text.match(/(?:account\s+number|acct\s*#?):\s*([X*\d\s-]{8,20})/i);
        if (accountMatch) {
          identifiers.account_number = accountMatch[1].replace(/\s/g, '');
        }
        break;
        
      case 'insurance_notice':
        // Policy and claim numbers
        const policyMatch = text.match(/(?:policy\s+number):\s*([A-Z0-9-]{6,20})/i);
        const claimMatch = text.match(/(?:claim\s+number):\s*([A-Z0-9-]{6,20})/i);
        
        if (policyMatch) identifiers.policy_number = policyMatch[1];
        if (claimMatch) identifiers.claim_number = claimMatch[1];
        break;
    }

    return Object.keys(identifiers).length > 0 ? identifiers : undefined;
  }

  /**
   * Extract instructions from text
   */
  private extractInstructions(text: string): string[] {
    const instructions = [];
    
    // Look for instruction patterns
    const instructionPatterns = [
      /(?:please|you must|required to|need to)\s+([^.!?]+[.!?])/gi,
      /(?:step \d+|first|second|third|next|then):\s*([^.\n]+)/gi,
      /(?:to\s+(?:complete|finish|process)):\s*([^.\n]+)/gi
    ];

    for (const pattern of instructionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const instruction = match[1].trim();
        if (instruction.length > 10 && instruction.length < 200) {
          instructions.push(instruction);
        }
      }
    }

    return instructions.slice(0, 5); // Limit to 5 instructions
  }

  /**
   * Extract required actions
   */
  private extractRequiredActions(text: string, docType: DocumentType): string[] {
    const actions = [];
    const textLower = text.toLowerCase();
    
    const actionPatterns = [
      /(?:must|required|need to|should)\s+(submit|upload|provide|send|mail|call|contact|pay|respond|appear|attend|bring|complete|sign)/gi,
      /(?:action required|immediate action|respond by|deadline)/gi,
      /(?:please\s+(?:submit|provide|send|call|contact|pay|respond))/gi
    ];

    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const action = match[0].trim();
        if (action.length > 5) {
          actions.push(action);
        }
      }
    }

    return actions.slice(0, 5);
  }

  /**
   * Extract mentioned attachments
   */
  private extractAttachments(text: string): string[] {
    const attachments = [];
    
    const attachmentPatterns = [
      /(?:attach|include|enclose|accompanying)\s+([^.!?\n]+)/gi,
      /(?:see attached|attachment|enclosure):\s*([^.\n]+)/gi
    ];

    for (const pattern of attachmentPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const attachment = match[1].trim();
        if (attachment.length > 5 && attachment.length < 100) {
          attachments.push(attachment);
        }
      }
    }

    return attachments.slice(0, 3);
  }

  /**
   * Extract USCIS-specific actions
   */
  private extractUSCISActions(text: string, extractedInfo: ExtractedInfo): Array<{
    label: string;
    description: string;
    due_date?: Date;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    action_type: ActionType;
    confidence: number;
    context: string;
  }> {
    const actions = [];
    const textLower = text.toLowerCase();

    // Biometrics appointment
    if (textLower.includes('biometric') && textLower.includes('appointment')) {
      actions.push({
        label: 'Attend Biometrics Appointment',
        description: 'Appear at the scheduled biometrics appointment',
        due_date: extractedInfo.dates?.appointment_date,
        priority: 'high' as const,
        action_type: 'schedule_appointment' as ActionType,
        confidence: 0.9,
        context: 'USCIS biometrics appointment'
      });
    }

    // Evidence submission
    if (textLower.includes('submit') && (textLower.includes('evidence') || textLower.includes('document'))) {
      actions.push({
        label: 'Submit Additional Evidence',
        description: 'Provide requested documentation to USCIS',
        due_date: extractedInfo.dates?.due_date,
        priority: 'high' as const,
        action_type: 'upload_document' as ActionType,
        confidence: 0.8,
        context: 'USCIS evidence request'
      });
    }

    // Case linking opportunity
    if (extractedInfo.identifiers?.receipt_number) {
      actions.push({
        label: 'Add to Case Tracker',
        description: 'Link this notice to your USCIS case tracker',
        priority: 'medium' as const,
        action_type: 'link_case' as ActionType,
        confidence: 0.9,
        context: 'USCIS case management'
      });
    }

    return actions;
  }

  /**
   * Extract insurance-specific actions
   */
  private extractInsuranceActions(text: string, extractedInfo: ExtractedInfo): Array<any> {
    const actions = [];
    const textLower = text.toLowerCase();

    // Call insurer
    if (textLower.includes('call') || textLower.includes('contact')) {
      actions.push({
        label: 'Call Insurance Company',
        description: 'Contact your insurance company for clarification',
        priority: 'medium' as const,
        action_type: 'call_service' as ActionType,
        confidence: 0.7,
        context: 'Insurance inquiry'
      });
    }

    // Review claim
    if (textLower.includes('claim') && textLower.includes('review')) {
      actions.push({
        label: 'Review Claim Details',
        description: 'Verify the accuracy of your insurance claim',
        priority: 'medium' as const,
        action_type: 'review_amount' as ActionType,
        confidence: 0.8,
        context: 'Insurance claim verification'
      });
    }

    return actions;
  }

  /**
   * Extract financial actions
   */
  private extractFinancialActions(text: string, extractedInfo: ExtractedInfo): Array<any> {
    const actions = [];
    const textLower = text.toLowerCase();

    // Payment due
    if ((textLower.includes('payment') || textLower.includes('pay')) && extractedInfo.amounts?.total_due) {
      actions.push({
        label: `Pay Amount Due ($${extractedInfo.amounts.total_due})`,
        description: 'Make payment to avoid late fees',
        due_date: extractedInfo.dates?.due_date,
        priority: 'high' as const,
        action_type: 'pay_bill' as ActionType,
        confidence: 0.9,
        context: 'Payment required'
      });
    }

    return actions;
  }

  /**
   * Extract utility actions
   */
  private extractUtilityActions(text: string, extractedInfo: ExtractedInfo): Array<any> {
    const actions = [];

    if (extractedInfo.amounts?.total_due) {
      actions.push({
        label: 'Pay Utility Bill',
        description: `Pay ${extractedInfo.amounts.total_due} utility bill`,
        due_date: extractedInfo.dates?.due_date,
        priority: 'medium' as const,
        action_type: 'pay_bill' as ActionType,
        confidence: 0.8,
        context: 'Utility payment'
      });
    }

    return actions;
  }

  /**
   * Extract tax document actions
   */
  private extractTaxActions(text: string, extractedInfo: ExtractedInfo): Array<any> {
    const actions = [];
    const textLower = text.toLowerCase();

    if (textLower.includes('file') || textLower.includes('return')) {
      actions.push({
        label: 'Review Tax Document',
        description: 'Review tax document for accuracy before filing',
        priority: 'medium' as const,
        action_type: 'review_amount' as ActionType,
        confidence: 0.8,
        context: 'Tax document review'
      });
    }

    return actions;
  }

  /**
   * Extract legal notice actions
   */
  private extractLegalActions(text: string, extractedInfo: ExtractedInfo): Array<any> {
    const actions = [];
    const textLower = text.toLowerCase();

    if (textLower.includes('respond') || textLower.includes('reply')) {
      actions.push({
        label: 'Respond to Legal Notice',
        description: 'Provide required response to legal notice',
        due_date: extractedInfo.dates?.due_date,
        priority: 'urgent' as const,
        action_type: 'respond_by_deadline' as ActionType,
        confidence: 0.9,
        context: 'Legal response required'
      });
    }

    return actions;
  }

  /**
   * Extract general actions
   */
  private extractGeneralActions(text: string, extractedInfo: ExtractedInfo): Array<any> {
    const actions = [];
    const textLower = text.toLowerCase();

    // Generic deadline response
    if (extractedInfo.dates?.due_date && textLower.includes('respond')) {
      const daysUntilDue = Math.ceil((extractedInfo.dates.due_date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      actions.push({
        label: 'Respond Before Deadline',
        description: `Respond to this document before ${format(extractedInfo.dates.due_date, 'MMM d, yyyy')}`,
        due_date: extractedInfo.dates.due_date,
        priority: daysUntilDue <= 3 ? 'urgent' as const : daysUntilDue <= 7 ? 'high' as const : 'medium' as const,
        action_type: 'respond_by_deadline' as ActionType,
        confidence: 0.7,
        context: 'General deadline response'
      });
    }

    return actions;
  }

  /**
   * Get context around a date match
   */
  private getDateContext(text: string, position: number): string {
    const start = Math.max(0, position - 50);
    const end = Math.min(text.length, position + 100);
    return text.substring(start, end);
  }

  /**
   * Get context around an amount match
   */
  private getAmountContext(text: string, position: number): string {
    const start = Math.max(0, position - 30);
    const end = Math.min(text.length, position + 50);
    return text.substring(start, end);
  }

  /**
   * Check if sender appears to be official
   */
  private isOfficialSender(organization: string, docType: DocumentType): boolean {
    const orgLower = organization.toLowerCase();
    
    const officialIndicators = [
      'uscis', 'u.s. citizenship', 'immigration services',
      'irs', 'internal revenue',
      'social security administration',
      'department of', 'agency', 'bureau of',
      'federal', 'state of', 'county of', 'city of'
    ];

    return officialIndicators.some(indicator => orgLower.includes(indicator));
  }

  /**
   * Calculate deadline urgency
   */
  private calculateDeadlineUrgency(dueDate?: Date): 'safe' | 'upcoming' | 'urgent' | 'overdue' {
    if (!dueDate) return 'safe';
    
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 3) return 'urgent';
    if (daysUntilDue <= 7) return 'upcoming';
    return 'safe';
  }
}