/**
 * Risk Analysis Service
 * Detects potential scams and suspicious documents
 */

import { logger } from '../utils/logger';
import type { RiskAnalysis, ExtractedInfo, DocumentType } from '../models/types';

export class RiskAnalysisService {

  async analyzeRisks(text: string, extractedInfo: ExtractedInfo, docType: DocumentType): Promise<RiskAnalysis> {
    try {
      const scamIndicators = this.detectScamIndicators(text, extractedInfo);
      const authenticityMarkers = this.checkAuthenticityMarkers(text, extractedInfo, docType);
      const riskScore = this.calculateRiskScore(scamIndicators, authenticityMarkers);
      
      const riskFactors = [];
      
      // High-risk indicators
      if (scamIndicators.length > 0) {
        riskFactors.push(`${scamIndicators.length} potential scam indicators detected`);
      }
      
      // Missing authenticity markers for official documents
      const missingMarkers = authenticityMarkers.filter(m => !m.present && m.weight > 0.3);
      if (missingMarkers.length > 0) {
        riskFactors.push(`Missing ${missingMarkers.length} expected official elements`);
      }

      // Urgency + payment combination (red flag)
      if (text.toLowerCase().includes('urgent') && text.toLowerCase().includes('payment')) {
        riskFactors.push('Urgent payment request detected');
      }

      const isSuspicious = riskScore > 0.6 || scamIndicators.some(s => s.confidence > 0.8);
      
      return {
        is_suspicious: isSuspicious,
        risk_factors: riskFactors,
        scam_indicators: scamIndicators,
        authenticity_markers: authenticityMarkers,
        recommendation: this.getRecommendation(riskScore, isSuspicious),
        risk_score: riskScore
      };
      
    } catch (error) {
      logger.error('Risk analysis failed:', error);
      throw error;
    }
  }

  private detectScamIndicators(text: string, extractedInfo: ExtractedInfo): Array<{
    indicator: string;
    confidence: number;
    description: string;
  }> {
    const indicators = [];
    const textLower = text.toLowerCase();

    // Gift card payment requests
    if (textLower.includes('gift card') || textLower.includes('prepaid card')) {
      indicators.push({
        indicator: 'gift_card_payment',
        confidence: 0.9,
        description: 'Requests payment via gift cards (common scam tactic)'
      });
    }

    // Wire transfer requests
    if (textLower.includes('wire transfer') || textLower.includes('western union') || textLower.includes('moneygram')) {
      indicators.push({
        indicator: 'wire_transfer',
        confidence: 0.8,
        description: 'Requests untraceable payment method'
      });
    }

    // Urgent threats
    const threatPatterns = [
      'immediate action required',
      'account will be closed',
      'legal action will be taken',
      'arrest warrant',
      'deportation'
    ];

    for (const pattern of threatPatterns) {
      if (textLower.includes(pattern)) {
        indicators.push({
          indicator: 'urgent_threat',
          confidence: 0.7,
          description: `Uses threatening language: "${pattern}"`
        });
      }
    }

    // Poor grammar/spelling (for official documents)
    const grammarIssues = this.detectGrammarIssues(text);
    if (grammarIssues.length > 3 && extractedInfo.sender?.official) {
      indicators.push({
        indicator: 'poor_grammar',
        confidence: 0.6,
        description: `${grammarIssues.length} grammar/spelling issues in official document`
      });
    }

    // Suspicious contact methods
    if (textLower.includes('call this number immediately') || textLower.includes('verify your information')) {
      indicators.push({
        indicator: 'phishing_attempt',
        confidence: 0.7,
        description: 'Requests immediate verification of personal information'
      });
    }

    // Unusual payment amounts (too high or suspiciously specific)
    if (extractedInfo.amounts?.total_due) {
      const amount = extractedInfo.amounts.total_due;
      if (amount > 10000 || (amount > 100 && amount % 1 !== 0 && amount.toString().includes('.99'))) {
        indicators.push({
          indicator: 'suspicious_amount',
          confidence: 0.5,
          description: 'Unusual payment amount pattern'
        });
      }
    }

    return indicators;
  }

  private checkAuthenticityMarkers(text: string, extractedInfo: ExtractedInfo, docType: DocumentType): Array<{
    marker: string;
    present: boolean;
    weight: number;
  }> {
    const markers = [];
    const textLower = text.toLowerCase();

    // Document-specific authenticity markers
    switch (docType) {
      case 'uscis_notice':
        markers.push(
          { marker: 'USCIS logo/header', present: textLower.includes('uscis') || textLower.includes('u.s. citizenship'), weight: 0.8 },
          { marker: 'Receipt number', present: !!extractedInfo.identifiers?.receipt_number, weight: 0.9 },
          { marker: 'Official address', present: textLower.includes('washington') || textLower.includes('federal'), weight: 0.6 },
          { marker: 'Form number', present: /form\s+[a-z]-\d+/i.test(text), weight: 0.7 }
        );
        break;

      case 'bank_statement':
      case 'credit_card_notice':
        markers.push(
          { marker: 'Bank name', present: !!extractedInfo.sender?.organization, weight: 0.8 },
          { marker: 'Account number', present: !!extractedInfo.identifiers?.account_number, weight: 0.9 },
          { marker: 'Routing information', present: textLower.includes('routing') || textLower.includes('aba'), weight: 0.5 },
          { marker: 'FDIC notice', present: textLower.includes('fdic'), weight: 0.6 }
        );
        break;

      case 'insurance_notice':
        markers.push(
          { marker: 'Insurance company', present: !!extractedInfo.sender?.organization, weight: 0.8 },
          { marker: 'Policy number', present: !!extractedInfo.identifiers?.policy_number, weight: 0.9 },
          { marker: 'Claim number', present: !!extractedInfo.identifiers?.claim_number, weight: 0.7 }
        );
        break;

      default:
        markers.push(
          { marker: 'Sender identification', present: !!extractedInfo.sender?.organization, weight: 0.7 },
          { marker: 'Contact information', present: !!(extractedInfo.sender?.phone || extractedInfo.sender?.email), weight: 0.6 }
        );
    }

    // Common official document markers
    markers.push(
      { marker: 'Professional formatting', present: this.hasOfficialFormatting(text), weight: 0.5 },
      { marker: 'Consistent sender info', present: this.hasConsistentSenderInfo(extractedInfo), weight: 0.6 }
    );

    return markers;
  }

  private detectGrammarIssues(text: string): string[] {
    const issues = [];
    
    // Simple grammar/spelling checks
    const commonMistakes = [
      { pattern: /\byou're\s+account\b/gi, issue: 'your vs you\'re confusion' },
      { pattern: /\bits\s+important\b/gi, issue: 'it\'s vs its confusion' },
      { pattern: /\bthere\s+account\b/gi, issue: 'their vs there confusion' },
      { pattern: /\brecieve\b/gi, issue: 'misspelled "receive"' },
      { pattern: /\bpayement\b/gi, issue: 'misspelled "payment"' }
    ];

    for (const mistake of commonMistakes) {
      if (mistake.pattern.test(text)) {
        issues.push(mistake.issue);
      }
    }

    // Check for excessive capitalization
    const sentences = text.split(/[.!?]+/);
    const allCapsCount = sentences.filter(s => s.trim().length > 20 && s === s.toUpperCase()).length;
    if (allCapsCount > 2) {
      issues.push('excessive all-caps text');
    }

    return issues;
  }

  private hasOfficialFormatting(text: string): boolean {
    // Check for professional document structure
    const hasHeaders = /^[A-Z][^.!?]*$/gm.test(text);
    const hasProperSpacing = !text.includes('  '); // No double spaces
    const hasConsistentCapitalization = !/[a-z][A-Z]/.test(text); // No random caps
    
    return hasHeaders && hasProperSpacing && hasConsistentCapitalization;
  }

  private hasConsistentSenderInfo(extractedInfo: ExtractedInfo): boolean {
    if (!extractedInfo.sender) return false;
    
    // Check if organization name appears multiple times consistently
    const org = extractedInfo.sender.organization;
    return !!(org && org.length > 3);
  }

  private calculateRiskScore(scamIndicators: any[], authenticityMarkers: any[]): number {
    // Base score from scam indicators
    let riskScore = 0;
    
    for (const indicator of scamIndicators) {
      riskScore += indicator.confidence * 0.3; // Max 30% per indicator
    }
    
    // Reduce score based on authenticity markers
    const authenticityScore = authenticityMarkers
      .filter(m => m.present)
      .reduce((sum, m) => sum + m.weight, 0) / authenticityMarkers.length;
    
    riskScore -= authenticityScore * 0.4;
    
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, riskScore));
  }

  private getRecommendation(riskScore: number, isSuspicious: boolean): 'proceed' | 'verify' | 'block' {
    if (riskScore > 0.8 || isSuspicious) {
      return 'block';
    } else if (riskScore > 0.4) {
      return 'verify';
    } else {
      return 'proceed';
    }
  }
}