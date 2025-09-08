import { MailUnderstandingService } from './MailUnderstandingService';

export interface CredentialDocument {
  id: string;
  type: 'diploma' | 'certificate' | 'license' | 'transcript' | 'experience';
  country: string;
  institution: string;
  fieldOfStudy: string;
  level: 'high_school' | 'associate' | 'bachelor' | 'master' | 'doctoral' | 'certificate' | 'professional';
  yearCompleted: number;
  extractedText: string;
  isVerified: boolean;
}

export interface JobPathway {
  id: string;
  title: string;
  industry: string;
  description: string;
  requirements: {
    education: string;
    certification?: string;
    experience: string;
    skills: string[];
  };
  salaryRange: {
    min: number;
    max: number;
    median: number;
  };
  growthOutlook: 'declining' | 'stable' | 'growing' | 'fast_growing';
  similarTitles: string[];
  pathwaySteps: PathwayStep[];
}

export interface LicensingRequirement {
  id: string;
  profession: string;
  state: string;
  requirements: {
    education: string;
    examinations: string[];
    experience: string;
    fees: number;
    timeline: string;
  };
  reciprocity: string[];
  renewalRequirements: {
    frequency: string;
    continuingEducation: number;
    fees: number;
  };
  resources: {
    website: string;
    contact: string;
    applicationForms: string[];
  };
}

export interface PathwayStep {
  step: number;
  title: string;
  description: string;
  timeframe: string;
  requirements: string[];
  resources: string[];
  cost?: number;
  isCompleted?: boolean;
}

export interface CredentialAnalysis {
  credentialId: string;
  pathways: JobPathway[];
  licensingRequirements: LicensingRequirement[];
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  equivalencyAssessment: {
    usEquivalent: string;
    credentialEvaluation: {
      recommended: boolean;
      agencies: string[];
      cost: number;
    };
  };
  skillsGapAnalysis: {
    existingSkills: string[];
    neededSkills: string[];
    trainingRecommendations: string[];
  };
}

export class CredentialPathwaysService {
  private mailUnderstandingService: MailUnderstandingService;
  private jobPathwaysDatabase: JobPathway[];
  private licensingDatabase: LicensingRequirement[];

  constructor() {
    this.mailUnderstandingService = new MailUnderstandingService();
    this.initializePathwaysDatabase();
  }

  /**
   * Analyze uploaded credentials and provide pathway recommendations
   */
  async analyzeCredentials(fileBuffer: Buffer, filename: string): Promise<CredentialAnalysis> {
    try {
      // Step 1: Extract and understand the credential document
      const documentAnalysis = await this.mailUnderstandingService.understandDocument(fileBuffer, filename);
      
      // Step 2: Parse credential information
      const credentialDoc = this.parseCredentialDocument(documentAnalysis);
      
      // Step 3: Find matching job pathways
      const matchingPathways = await this.findJobPathways(credentialDoc);
      
      // Step 4: Find licensing requirements
      const licensingRequirements = await this.findLicensingRequirements(credentialDoc);
      
      // Step 5: Perform equivalency assessment
      const equivalencyAssessment = await this.assessCredentialEquivalency(credentialDoc);
      
      // Step 6: Generate recommendations
      const recommendations = this.generateRecommendations(credentialDoc, matchingPathways, licensingRequirements);
      
      // Step 7: Skills gap analysis
      const skillsGapAnalysis = this.performSkillsGapAnalysis(credentialDoc, matchingPathways);

      return {
        credentialId: credentialDoc.id,
        pathways: matchingPathways,
        licensingRequirements,
        recommendations,
        equivalencyAssessment,
        skillsGapAnalysis
      };
    } catch (error) {
      console.error('Error analyzing credentials:', error);
      throw new Error(`Failed to analyze credentials: ${error.message}`);
    }
  }

  /**
   * Parse credential document from extracted text
   */
  private parseCredentialDocument(documentAnalysis: any): CredentialDocument {
    const text = documentAnalysis.extractedText;
    
    return {
      id: documentAnalysis.id,
      type: this.identifyCredentialType(text),
      country: this.extractCountry(text),
      institution: this.extractInstitution(text),
      fieldOfStudy: this.extractFieldOfStudy(text),
      level: this.extractEducationLevel(text),
      yearCompleted: this.extractYearCompleted(text),
      extractedText: text,
      isVerified: false
    };
  }

  /**
   * Identify the type of credential document
   */
  private identifyCredentialType(text: string): 'diploma' | 'certificate' | 'license' | 'transcript' | 'experience' {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('diploma') || lowerText.includes('degree')) return 'diploma';
    if (lowerText.includes('certificate') || lowerText.includes('certification')) return 'certificate';
    if (lowerText.includes('license') || lowerText.includes('licensed')) return 'license';
    if (lowerText.includes('transcript') || lowerText.includes('academic record')) return 'transcript';
    if (lowerText.includes('experience') || lowerText.includes('employment')) return 'experience';
    
    return 'certificate'; // Default
  }

  /**
   * Extract country information from credential
   */
  private extractCountry(text: string): string {
    const countries = [
      'India', 'Philippines', 'Mexico', 'China', 'Nigeria', 'Pakistan', 'Iran', 'Iraq',
      'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Brazil', 'Colombia'
    ];
    
    for (const country of countries) {
      if (text.includes(country)) {
        return country;
      }
    }
    
    return 'Unknown';
  }

  /**
   * Extract institution name from credential
   */
  private extractInstitution(text: string): string {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Look for institution patterns
    for (const line of lines.slice(0, 10)) {
      if (line.match(/(university|college|institute|school|academy)/i) && line.length < 150) {
        return line;
      }
    }
    
    return 'Unknown Institution';
  }

  /**
   * Extract field of study from credential
   */
  private extractFieldOfStudy(text: string): string {
    const commonFields = [
      'Computer Science', 'Engineering', 'Medicine', 'Nursing', 'Business', 'Education',
      'Law', 'Psychology', 'Biology', 'Chemistry', 'Physics', 'Mathematics',
      'Economics', 'Accounting', 'Marketing', 'Finance', 'Architecture'
    ];
    
    const lowerText = text.toLowerCase();
    
    for (const field of commonFields) {
      if (lowerText.includes(field.toLowerCase())) {
        return field;
      }
    }
    
    // Try to extract from degree patterns
    const degreeMatch = text.match(/(bachelor|master|doctor).{0,50}(of|in|degree)\s+([A-Za-z\s]{3,30})/i);
    if (degreeMatch) {
      return degreeMatch[3].trim();
    }
    
    return 'General Studies';
  }

  /**
   * Extract education level from credential
   */
  private extractEducationLevel(text: string): 'high_school' | 'associate' | 'bachelor' | 'master' | 'doctoral' | 'certificate' | 'professional' {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('phd') || lowerText.includes('doctorate') || lowerText.includes('doctoral')) return 'doctoral';
    if (lowerText.includes('master') || lowerText.includes('mba') || lowerText.includes('ms') || lowerText.includes('ma')) return 'master';
    if (lowerText.includes('bachelor') || lowerText.includes('bs') || lowerText.includes('ba') || lowerText.includes('bsc')) return 'bachelor';
    if (lowerText.includes('associate')) return 'associate';
    if (lowerText.includes('high school') || lowerText.includes('secondary')) return 'high_school';
    if (lowerText.includes('professional') || lowerText.includes('license')) return 'professional';
    
    return 'certificate';
  }

  /**
   * Extract year of completion from credential
   */
  private extractYearCompleted(text: string): number {
    const currentYear = new Date().getFullYear();
    const yearMatch = text.match(/(19|20)\d{2}/g);
    
    if (yearMatch) {
      const years = yearMatch.map(y => parseInt(y)).filter(y => y >= 1950 && y <= currentYear);
      return Math.max(...years) || currentYear;
    }
    
    return currentYear;
  }

  /**
   * Find matching job pathways based on credentials
   */
  private async findJobPathways(credential: CredentialDocument): Promise<JobPathway[]> {
    try {
      // Filter pathways based on field of study and education level
      const matchingPathways = this.jobPathwaysDatabase.filter(pathway => {
        const fieldMatch = pathway.title.toLowerCase().includes(credential.fieldOfStudy.toLowerCase()) ||
                          pathway.description.toLowerCase().includes(credential.fieldOfStudy.toLowerCase());
        
        const levelMatch = this.checkEducationLevelMatch(credential.level, pathway.requirements.education);
        
        return fieldMatch || levelMatch;
      });

      // Sort by relevance
      return matchingPathways.slice(0, 10); // Return top 10 matches
    } catch (error) {
      console.error('Error finding job pathways:', error);
      return [];
    }
  }

  /**
   * Find relevant licensing requirements
   */
  private async findLicensingRequirements(credential: CredentialDocument): Promise<LicensingRequirement[]> {
    try {
      const matchingLicenses = this.licensingDatabase.filter(license => {
        return license.profession.toLowerCase().includes(credential.fieldOfStudy.toLowerCase());
      });

      return matchingLicenses.slice(0, 5); // Return top 5 matches
    } catch (error) {
      console.error('Error finding licensing requirements:', error);
      return [];
    }
  }

  /**
   * Assess credential equivalency in US system
   */
  private async assessCredentialEquivalency(credential: CredentialDocument) {
    // Simplified equivalency assessment
    const equivalencyMap = {
      'high_school': 'High School Diploma',
      'associate': 'Associate Degree',
      'bachelor': 'Bachelor\'s Degree',
      'master': 'Master\'s Degree',
      'doctoral': 'Doctoral Degree',
      'certificate': 'Professional Certificate',
      'professional': 'Professional License'
    };

    const needsEvaluation = credential.country !== 'United States' && 
                           ['bachelor', 'master', 'doctoral'].includes(credential.level);

    return {
      usEquivalent: equivalencyMap[credential.level] || 'Certificate',
      credentialEvaluation: {
        recommended: needsEvaluation,
        agencies: needsEvaluation ? [
          'World Education Services (WES)',
          'Educational Credential Evaluators (ECE)',
          'National Association of Credential Evaluation Services (NACES)'
        ] : [],
        cost: needsEvaluation ? 200 : 0
      }
    };
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendations(
    credential: CredentialDocument, 
    pathways: JobPathway[], 
    licensing: LicensingRequirement[]
  ) {
    return {
      immediate: [
        'Get credential evaluation from approved agency',
        'Update resume with US equivalent education',
        'Research job market in target location'
      ],
      shortTerm: [
        'Obtain necessary certifications for target field',
        'Improve English language skills if needed',
        'Network with professionals in the field'
      ],
      longTerm: [
        'Consider additional US education if required',
        'Pursue professional licensing if applicable',
        'Build US work experience in the field'
      ]
    };
  }

  /**
   * Perform skills gap analysis
   */
  private performSkillsGapAnalysis(credential: CredentialDocument, pathways: JobPathway[]) {
    // Extract skills from credential field
    const existingSkills = this.getSkillsForField(credential.fieldOfStudy);
    
    // Get required skills from pathways
    const neededSkills = pathways.reduce((skills, pathway) => {
      return skills.concat(pathway.requirements.skills);
    }, [] as string[]);

    const uniqueNeededSkills = [...new Set(neededSkills)];
    const skillsGap = uniqueNeededSkills.filter(skill => !existingSkills.includes(skill));

    return {
      existingSkills,
      neededSkills: uniqueNeededSkills,
      trainingRecommendations: this.generateTrainingRecommendations(skillsGap)
    };
  }

  /**
   * Get skills typically associated with a field of study
   */
  private getSkillsForField(field: string): string[] {
    const skillsMap: Record<string, string[]> = {
      'Computer Science': ['Programming', 'Software Development', 'Database Management', 'Web Development'],
      'Engineering': ['Problem Solving', 'Technical Analysis', 'Project Management', 'CAD Software'],
      'Medicine': ['Patient Care', 'Diagnosis', 'Medical Procedures', 'Healthcare Compliance'],
      'Business': ['Management', 'Financial Analysis', 'Strategic Planning', 'Leadership'],
      'Education': ['Teaching', 'Curriculum Development', 'Assessment', 'Classroom Management']
    };

    return skillsMap[field] || ['Communication', 'Problem Solving', 'Teamwork'];
  }

  /**
   * Generate training recommendations for skills gap
   */
  private generateTrainingRecommendations(skillsGap: string[]): string[] {
    return skillsGap.map(skill => `Consider taking courses in ${skill} to improve competitiveness`);
  }

  /**
   * Check if education level matches pathway requirements
   */
  private checkEducationLevelMatch(credentialLevel: string, pathwayRequirement: string): boolean {
    const levelHierarchy = {
      'high_school': 1,
      'certificate': 2,
      'associate': 3,
      'bachelor': 4,
      'master': 5,
      'doctoral': 6,
      'professional': 5
    };

    const credLevel = levelHierarchy[credentialLevel as keyof typeof levelHierarchy] || 2;
    
    // Simple matching logic
    if (pathwayRequirement.toLowerCase().includes('bachelor')) return credLevel >= 4;
    if (pathwayRequirement.toLowerCase().includes('master')) return credLevel >= 5;
    if (pathwayRequirement.toLowerCase().includes('doctoral')) return credLevel >= 6;
    if (pathwayRequirement.toLowerCase().includes('associate')) return credLevel >= 3;
    
    return credLevel >= 2; // Default to certificate level
  }

  /**
   * Initialize pathways and licensing databases
   */
  private initializePathwaysDatabase(): void {
    // Sample job pathways data
    this.jobPathwaysDatabase = [
      {
        id: 'software-engineer',
        title: 'Software Engineer',
        industry: 'Technology',
        description: 'Design and develop software applications',
        requirements: {
          education: 'Bachelor\'s degree in Computer Science or related field',
          experience: '2-5 years of programming experience',
          skills: ['Programming', 'Software Development', 'Problem Solving', 'Teamwork']
        },
        salaryRange: { min: 70000, max: 150000, median: 105000 },
        growthOutlook: 'fast_growing',
        similarTitles: ['Software Developer', 'Software Programmer', 'Application Developer'],
        pathwaySteps: [
          {
            step: 1,
            title: 'Get Credential Evaluation',
            description: 'Have foreign credentials evaluated by approved agency',
            timeframe: '1-2 months',
            requirements: ['Official transcripts', 'Application fee'],
            resources: ['WES.org', 'ECE.org'],
            cost: 200
          },
          {
            step: 2,
            title: 'Learn US Technologies',
            description: 'Familiarize with popular US tech stack',
            timeframe: '3-6 months',
            requirements: ['Self-study or bootcamp'],
            resources: ['Coursera', 'Udemy', 'freeCodeCamp'],
            cost: 500
          }
        ]
      }
      // Add more pathways as needed
    ];

    // Sample licensing requirements data
    this.licensingDatabase = [
      {
        id: 'nursing-license',
        profession: 'Nursing',
        state: 'All States',
        requirements: {
          education: 'Nursing degree from approved program',
          examinations: ['NCLEX-RN'],
          experience: 'Clinical training as part of education',
          fees: 300,
          timeline: '3-6 months'
        },
        reciprocity: ['Compact States'],
        renewalRequirements: {
          frequency: 'Every 2 years',
          continuingEducation: 24,
          fees: 150
        },
        resources: {
          website: 'https://www.ncsbn.org',
          contact: 'State Board of Nursing',
          applicationForms: ['Application for License', 'Background Check Form']
        }
      }
      // Add more licensing requirements as needed
    ];
  }

  /**
   * Get pathway requirements by profession
   */
  async getPathwayRequirements(profession: string): Promise<JobPathway[]> {
    return this.jobPathwaysDatabase.filter(pathway =>
      pathway.title.toLowerCase().includes(profession.toLowerCase()) ||
      pathway.industry.toLowerCase().includes(profession.toLowerCase())
    );
  }

  /**
   * Get licensing requirements by profession and state
   */
  async getLicensingRequirements(profession: string, state?: string): Promise<LicensingRequirement[]> {
    return this.licensingDatabase.filter(license => {
      const professionMatch = license.profession.toLowerCase().includes(profession.toLowerCase());
      const stateMatch = !state || license.state === 'All States' || license.state === state;
      return professionMatch && stateMatch;
    });
  }
}