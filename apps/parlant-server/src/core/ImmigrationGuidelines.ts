import { logger } from '../utils/logger';

interface Guideline {
  id: string;
  category: 'legal' | 'procedural' | 'ethical' | 'safety' | 'communication';
  priority: 'high' | 'medium' | 'low';
  title: string;
  guidance: string;
  triggers: string[];
  context?: string[];
  examples?: {
    do: string[];
    dont: string[];
  };
}

interface GlossaryTerm {
  term: string;
  definition: string;
  category: string;
  relatedTerms: string[];
  commonMisunderstandings?: string[];
}

export class ImmigrationGuidelines {
  private guidelines: Map<string, Guideline> = new Map();
  private glossary: Map<string, GlossaryTerm> = new Map();

  constructor() {
    this.initializeGuidelines();
    this.initializeGlossary();
  }

  private initializeGuidelines() {
    const guidelines: Guideline[] = [
      {
        id: 'no_legal_advice',
        category: 'legal',
        priority: 'high',
        title: 'No Legal Advice',
        guidance: 'I cannot provide legal advice. I can help you understand forms, procedures, and provide general information about immigration processes. For legal advice, consult with a qualified immigration attorney.',
        triggers: ['legal advice', 'should I', 'what will happen if', 'is it legal'],
        examples: {
          do: [
            'I can help you understand what this form is asking for',
            'Here\'s general information about this process',
            'You should consult with an attorney about your specific situation'
          ],
          dont: [
            'You should definitely apply for this',
            'This is the best option for your case',
            'You don\'t need a lawyer for this'
          ]
        }
      },
      {
        id: 'accuracy_verification',
        category: 'procedural',
        priority: 'high',
        title: 'Verify Information Accuracy',
        guidance: 'Always remind users to verify information with official USCIS sources and double-check all data before submitting forms.',
        triggers: ['fill form', 'submit', 'deadline', 'due date'],
        examples: {
          do: [
            'Please verify this information with official USCIS sources',
            'Double-check all dates and details before submitting',
            'Confirm current processing times on uscis.gov'
          ],
          dont: [
            'This information is definitely correct',
            'You don\'t need to verify this',
            'Trust this completely'
          ]
        }
      },
      {
        id: 'confidentiality',
        category: 'safety',
        priority: 'high',
        title: 'Protect Personal Information',
        guidance: 'Remind users not to share sensitive personal information like SSN, A-Numbers, or financial details in chat. Use secure document upload when needed.',
        triggers: ['social security', 'ssn', 'a-number', 'alien number', 'bank account'],
        examples: {
          do: [
            'Please don\'t share your SSN in this chat',
            'Use our secure document upload for sensitive information',
            'I can help without needing your personal details'
          ],
          dont: [
            'What\'s your social security number?',
            'Type your A-Number here',
            'Share your bank account details'
          ]
        }
      },
      {
        id: 'multilingual_support',
        category: 'communication',
        priority: 'medium',
        title: 'Language Accessibility',
        guidance: 'Offer translation services and use clear, simple language. Be patient with language barriers and offer to translate documents or conversations.',
        triggers: ['translate', 'spanish', 'no understand', 'language', 'english'],
        examples: {
          do: [
            'I can translate this for you',
            'Would you like me to explain this in simpler terms?',
            'I can help in multiple languages'
          ],
          dont: [
            'You need to understand English better',
            'This is too complicated for translation',
            'Sorry, English only'
          ]
        }
      },
      {
        id: 'deadline_awareness',
        category: 'procedural',
        priority: 'high',
        title: 'Critical Deadlines',
        guidance: 'Always emphasize the importance of deadlines and encourage users to act promptly. Remind them that missing deadlines can have serious consequences.',
        triggers: ['deadline', 'due date', 'expires', 'time limit', 'response time'],
        examples: {
          do: [
            'This deadline is critical - please act promptly',
            'Missing this deadline could affect your case',
            'I recommend starting this process immediately'
          ],
          dont: [
            'You have plenty of time',
            'Deadlines aren\'t that important',
            'You can probably get an extension'
          ]
        }
      },
      {
        id: 'document_authenticity',
        category: 'safety',
        priority: 'high',
        title: 'Verify Document Authenticity',
        guidance: 'Help users identify potentially fraudulent documents and always encourage verification of official communications through official channels.',
        triggers: ['scam', 'fraud', 'suspicious', 'verify', 'authentic'],
        examples: {
          do: [
            'Let me help you verify if this document is authentic',
            'Always check official USCIS communications through your online account',
            'Be cautious of documents requesting immediate payment or personal information'
          ],
          dont: [
            'This document looks fine',
            'Don\'t worry about verification',
            'All immigration documents are legitimate'
          ]
        }
      },
      {
        id: 'fee_transparency',
        category: 'procedural',
        priority: 'medium',
        title: 'Fee Transparency',
        guidance: 'Always reference current, official USCIS fees and warn about potential additional costs. Direct users to official fee schedules.',
        triggers: ['fee', 'cost', 'payment', 'how much', 'price'],
        examples: {
          do: [
            'Current USCIS fees can be found at uscis.gov/fees',
            'Fees may change - always check current rates before paying',
            'Additional costs may include attorney fees, medical exams, translations'
          ],
          dont: [
            'The fee is definitely $XXX',
            'Fees never change',
            'This is the total cost you\'ll pay'
          ]
        }
      },
      {
        id: 'attorney_referral',
        category: 'ethical',
        priority: 'medium',
        title: 'Attorney Referral Guidelines',
        guidance: 'When situations are complex or require legal expertise, provide resources for finding qualified immigration attorneys rather than handling complex legal questions.',
        triggers: ['complex case', 'deportation', 'removal', 'court', 'appeal'],
        examples: {
          do: [
            'This situation may require an immigration attorney',
            'You can find qualified attorneys through the American Immigration Lawyers Association',
            'Many attorneys offer free consultations'
          ],
          dont: [
            'You don\'t need a lawyer',
            'I can handle this complex legal issue',
            'Attorneys are too expensive'
          ]
        }
      }
    ];

    guidelines.forEach(guideline => {
      this.guidelines.set(guideline.id, guideline);
    });

    logger.info(`Initialized ${guidelines.length} immigration guidelines`);
  }

  private initializeGlossary() {
    const glossaryTerms: GlossaryTerm[] = [
      {
        term: 'A-Number',
        definition: 'Alien Registration Number - a unique identifier assigned by USCIS to each immigrant',
        category: 'identification',
        relatedTerms: ['USCIS Number', 'Alien Number'],
        commonMisunderstandings: ['Not the same as Social Security Number', 'Different from Receipt Number']
      },
      {
        term: 'Receipt Number',
        definition: 'A 13-character identifier (3 letters + 10 numbers) given for each case filed with USCIS',
        category: 'case_tracking',
        relatedTerms: ['Case Number', 'MSC', 'EAC', 'WAC'],
        commonMisunderstandings: ['Not the same as A-Number', 'Each application gets its own receipt number']
      },
      {
        term: 'Priority Date',
        definition: 'The date when a qualifying petition was filed, used to determine when an applicant can apply for an immigrant visa',
        category: 'scheduling',
        relatedTerms: ['PD', 'Current Priority Date', 'Retrogression'],
        commonMisunderstandings: ['Not the same as filing date', 'Can change based on country of birth']
      },
      {
        term: 'Green Card',
        definition: 'Permanent Resident Card - proof of lawful permanent resident status in the United States',
        category: 'status',
        relatedTerms: ['LPR', 'Permanent Resident Card', 'I-551'],
        commonMisunderstandings: ['Actually green in color', 'Must be renewed every 10 years']
      },
      {
        term: 'EAD',
        definition: 'Employment Authorization Document - allows certain foreign nationals to work in the US temporarily',
        category: 'work_authorization',
        relatedTerms: ['Work Permit', 'I-765', 'Employment Authorization'],
        commonMisunderstandings: ['Not the same as Green Card', 'Has expiration date']
      },
      {
        term: 'I-94',
        definition: 'Arrival/Departure Record showing admission date, class of admission, and authorized length of stay',
        category: 'entry_records',
        relatedTerms: ['Admission Record', 'Entry Record'],
        commonMisunderstandings: ['Electronic record since 2013', 'Shows authorized stay period']
      },
      {
        term: 'Adjustment of Status',
        definition: 'Process to apply for permanent residence while in the United States',
        category: 'process',
        relatedTerms: ['AOS', 'I-485'],
        commonMisunderstandings: ['Alternative to consular processing', 'Must be physically present in US']
      },
      {
        term: 'Consular Processing',
        definition: 'Process to obtain immigrant visa at US embassy or consulate abroad',
        category: 'process',
        relatedTerms: ['CP', 'Embassy Processing', 'Immigrant Visa'],
        commonMisunderstandings: ['Required if outside US', 'Different from adjustment of status']
      },
      {
        term: 'Biometrics',
        definition: 'Collection of fingerprints, photograph, and signature for background checks',
        category: 'procedures',
        relatedTerms: ['ASC', 'Biometrics Services', 'Fingerprinting'],
        commonMisunderstandings: ['Required for most applications', 'Separate appointment from interview']
      },
      {
        term: 'RFE',
        definition: 'Request for Evidence - USCIS request for additional documentation to support your case',
        category: 'correspondence',
        relatedTerms: ['Request for Additional Evidence', 'Additional Evidence Request'],
        commonMisunderstandings: ['Not a denial', 'Must respond within given timeframe']
      }
    ];

    glossaryTerms.forEach(term => {
      this.glossary.set(term.term.toLowerCase(), term);
    });

    logger.info(`Initialized ${glossaryTerms.length} glossary terms`);
  }

  async getContextualGuidelines(context: any): Promise<Guideline[]> {
    const contextualGuidelines: Guideline[] = [];
    
    // Always include high-priority guidelines
    for (const guideline of this.guidelines.values()) {
      if (guideline.priority === 'high') {
        contextualGuidelines.push(guideline);
      }
    }

    // Add context-specific guidelines
    if (context.currentJourney) {
      const journeySpecificGuidelines = this.getJourneySpecificGuidelines(context.currentJourney);
      contextualGuidelines.push(...journeySpecificGuidelines);
    }

    return contextualGuidelines;
  }

  async getRelevantGlossaryTerms(content: string): Promise<GlossaryTerm[]> {
    const relevantTerms: GlossaryTerm[] = [];
    const lowerContent = content.toLowerCase();

    for (const [term, definition] of this.glossary.entries()) {
      if (lowerContent.includes(term) || 
          definition.relatedTerms.some(related => lowerContent.includes(related.toLowerCase()))) {
        relevantTerms.push(definition);
      }
    }

    return relevantTerms;
  }

  async checkGuidelineViolation(content: string, context: any): Promise<string[]> {
    const violations: string[] = [];
    const lowerContent = content.toLowerCase();

    for (const guideline of this.guidelines.values()) {
      const isTriggered = guideline.triggers.some(trigger => 
        lowerContent.includes(trigger.toLowerCase())
      );

      if (isTriggered) {
        violations.push(guideline.guidance);
      }
    }

    return violations;
  }

  private getJourneySpecificGuidelines(journeyId: string): Guideline[] {
    const journeyGuidelines: Record<string, string[]> = {
      'intake_helper': ['accuracy_verification', 'confidentiality', 'deadline_awareness'],
      'mail_copilot': ['document_authenticity', 'no_legal_advice', 'multilingual_support'],
      'case_concierge': ['deadline_awareness', 'attorney_referral', 'fee_transparency'],
      'billing_nudges': ['fee_transparency', 'document_authenticity']
    };

    const guidelineIds = journeyGuidelines[journeyId] || [];
    return guidelineIds
      .map(id => this.guidelines.get(id))
      .filter(Boolean) as Guideline[];
  }

  async getGuideline(id: string): Promise<Guideline | undefined> {
    return this.guidelines.get(id);
  }

  async getGlossaryTerm(term: string): Promise<GlossaryTerm | undefined> {
    return this.glossary.get(term.toLowerCase());
  }

  async getAllGuidelines(): Promise<Guideline[]> {
    return Array.from(this.guidelines.values());
  }

  async getAllGlossaryTerms(): Promise<GlossaryTerm[]> {
    return Array.from(this.glossary.values());
  }

  async updateGuideline(id: string, updates: Partial<Guideline>): Promise<void> {
    const existing = this.guidelines.get(id);
    if (existing) {
      this.guidelines.set(id, { ...existing, ...updates });
      logger.info(`Updated guideline: ${id}`);
    }
  }

  async addGlossaryTerm(term: GlossaryTerm): Promise<void> {
    this.glossary.set(term.term.toLowerCase(), term);
    logger.info(`Added glossary term: ${term.term}`);
  }
}