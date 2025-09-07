/**
 * Summarization Service
 * Generates plain-language summaries and key points
 */

import nlp from 'compromise';
import { format } from 'date-fns';
import { logger } from '../utils/logger';

import type { SummaryResult, ExtractedInfo, DocumentType } from '../models/types';

export class SummarizationService {

  async generateSummary(
    text: string,
    extractedInfo: ExtractedInfo,
    docType: DocumentType,
    userLanguage: string = 'en'
  ): Promise<SummaryResult> {
    try {
      const keyPoints = this.extractKeyPoints(text, extractedInfo, docType);
      const actionItems = this.generateActionItems(extractedInfo, docType);
      const urgencyLevel = this.determineUrgencyLevel(extractedInfo);
      const summary = this.generatePlainLanguageSummary(keyPoints, actionItems, extractedInfo, docType);

      return {
        summary,
        key_points: keyPoints,
        action_items: actionItems,
        urgency_level: urgencyLevel,
        plain_language_score: this.calculatePlainLanguageScore(summary)
      };

    } catch (error) {
      logger.error('Summary generation failed:', error);
      throw error;
    }
  }

  private extractKeyPoints(text: string, extractedInfo: ExtractedInfo, docType: DocumentType): string[] {
    const points = [];

    // Add sender information
    if (extractedInfo.sender?.organization) {
      points.push(`From: ${extractedInfo.sender.organization}`);
    }

    // Add document type context
    const docTypeDescriptions = {
      uscis_notice: 'USCIS Immigration Notice',
      insurance_notice: 'Insurance Communication',
      bank_statement: 'Bank Statement',
      credit_card_notice: 'Credit Card Statement',
      utility_bill: 'Utility Bill',
      tax_document: 'Tax Document',
      legal_notice: 'Legal Notice',
      other: 'Document'
    };

    points.push(`Type: ${docTypeDescriptions[docType]}`);

    // Add key dates
    if (extractedInfo.dates?.due_date) {
      points.push(`Due Date: ${format(extractedInfo.dates.due_date, 'MMMM d, yyyy')}`);
    }
    if (extractedInfo.dates?.appointment_date) {
      points.push(`Appointment: ${format(extractedInfo.dates.appointment_date, 'MMMM d, yyyy')}`);
    }

    // Add amounts
    if (extractedInfo.amounts?.total_due) {
      points.push(`Amount Due: $${extractedInfo.amounts.total_due.toLocaleString()}`);
    }

    // Add identifiers
    if (extractedInfo.identifiers?.case_number) {
      points.push(`Case Number: ${extractedInfo.identifiers.case_number}`);
    }
    if (extractedInfo.identifiers?.account_number) {
      points.push(`Account: ${extractedInfo.identifiers.account_number}`);
    }

    return points.slice(0, 6);
  }

  private generateActionItems(extractedInfo: ExtractedInfo, docType: DocumentType): string[] {
    const items = [];

    // Generate based on document type and extracted info
    switch (docType) {
      case 'uscis_notice':
        if (extractedInfo.dates?.appointment_date) {
          items.push('Attend your scheduled appointment');
        }
        if (extractedInfo.identifiers?.receipt_number) {
          items.push('Track your case status online');
        }
        break;

      case 'credit_card_notice':
      case 'utility_bill':
        if (extractedInfo.amounts?.total_due && extractedInfo.dates?.due_date) {
          items.push(`Pay $${extractedInfo.amounts.total_due} by ${format(extractedInfo.dates.due_date, 'MMM d')}`);
        }
        break;

      case 'insurance_notice':
        items.push('Review your insurance coverage details');
        if (extractedInfo.sender?.phone) {
          items.push('Call your insurance company if you have questions');
        }
        break;
    }

    // Add general actions from extracted text
    if (extractedInfo.required_actions) {
      items.push(...extractedInfo.required_actions.slice(0, 2));
    }

    return items.slice(0, 5);
  }

  private generatePlainLanguageSummary(
    keyPoints: string[],
    actionItems: string[],
    extractedInfo: ExtractedInfo,
    docType: DocumentType
  ): string {
    let summary = '';

    // Opening statement based on document type
    const openings = {
      uscis_notice: 'This is a notice from USCIS about your immigration case.',
      insurance_notice: 'This is a communication from your insurance company.',
      bank_statement: 'This is a statement from your bank.',
      credit_card_notice: 'This is a statement from your credit card company.',
      utility_bill: 'This is a bill for your utility services.',
      tax_document: 'This is a tax-related document.',
      legal_notice: 'This is an important legal notice.',
      other: 'This document contains important information.'
    };

    summary += openings[docType] || openings.other;

    // Add key information
    if (extractedInfo.amounts?.total_due) {
      summary += ` You owe $${extractedInfo.amounts.total_due.toLocaleString()}.`;
    }

    if (extractedInfo.dates?.due_date) {
      const daysUntil = Math.ceil((extractedInfo.dates.due_date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntil < 0) {
        summary += ` The deadline has passed.`;
      } else if (daysUntil <= 3) {
        summary += ` You have ${daysUntil} day${daysUntil !== 1 ? 's' : ''} to respond.`;
      } else if (daysUntil <= 7) {
        summary += ` You have about a week to respond.`;
      } else {
        summary += ` The deadline is ${format(extractedInfo.dates.due_date, 'MMMM d')}.`;
      }
    }

    // Add most important action
    if (actionItems.length > 0) {
      summary += ` ${actionItems[0]}.`;
    }

    // Add reassurance or warnings
    if (docType === 'uscis_notice') {
      summary += ' Keep this notice safe and follow all instructions carefully.';
    } else if (extractedInfo.amounts?.total_due && extractedInfo.dates?.due_date) {
      summary += ' Pay on time to avoid late fees.';
    }

    return summary;
  }

  private determineUrgencyLevel(extractedInfo: ExtractedInfo): 'low' | 'medium' | 'high' | 'critical' {
    // Check for overdue dates
    if (extractedInfo.dates?.due_date) {
      const now = new Date();
      const daysUntil = Math.ceil((extractedInfo.dates.due_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntil < 0) return 'critical'; // Overdue
      if (daysUntil <= 1) return 'critical'; // Due tomorrow or today
      if (daysUntil <= 3) return 'high'; // Due within 3 days
      if (daysUntil <= 7) return 'medium'; // Due within a week
    }

    // High urgency for large amounts
    if (extractedInfo.amounts?.total_due && extractedInfo.amounts.total_due > 1000) {
      return 'high';
    }

    // Default based on document type
    const urgencyByType = {
      uscis_notice: 'high',
      legal_notice: 'high',
      credit_card_notice: 'medium',
      utility_bill: 'medium',
      insurance_notice: 'medium',
      bank_statement: 'low',
      tax_document: 'medium',
      other: 'low'
    };

    return urgencyByType[extractedInfo.sender?.official ? 'uscis_notice' : 'other'] as any || 'low';
  }

  private calculatePlainLanguageScore(text: string): number {
    // Simple readability score based on sentence length and common words
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/);
    
    const avgSentenceLength = words.length / sentences.length;
    const commonWords = this.countCommonWords(words);
    const commonWordRatio = commonWords / words.length;
    
    // Score from 0-1 (1 = most readable)
    let score = 1.0;
    
    // Penalize long sentences
    if (avgSentenceLength > 20) score -= 0.2;
    if (avgSentenceLength > 30) score -= 0.2;
    
    // Reward common word usage
    score += (commonWordRatio - 0.5) * 0.4;
    
    return Math.max(0, Math.min(1, score));
  }

  private countCommonWords(words: string[]): number {
    const commonWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'you', 'your', 'this', 'that', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'can', 'may', 'must', 'need', 'want', 'get', 'make', 'take', 'give', 'go', 'come',
      'see', 'know', 'think', 'say', 'tell', 'ask', 'work', 'help', 'use', 'find',
      'pay', 'send', 'call', 'write', 'read', 'look', 'feel', 'keep', 'leave', 'put'
    ]);
    
    return words.filter(word => commonWords.has(word.toLowerCase())).length;
  }
}