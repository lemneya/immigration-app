import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { 
  CaseStatus, 
  USCISApiResponse, 
  USCISServiceConfig, 
  ReceiptNumberValidation 
} from '../types';

export class USCISClient {
  private client: AxiosInstance;
  private config: USCISServiceConfig;
  private rateLimitDelay: number = 2000; // 2 seconds between requests

  constructor(config: USCISServiceConfig) {
    this.config = config;
    
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://egov.uscis.gov',
      timeout: config.timeout || 30000,
      headers: {
        'User-Agent': config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    // Add request interceptor for rate limiting
    this.client.interceptors.request.use(
      async (config) => {
        await this.delay(this.rateLimitDelay);
        console.log(`USCIS API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('USCIS API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`USCIS API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('USCIS API Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get case status by receipt number
   */
  async getCaseStatus(receiptNumber: string): Promise<USCISApiResponse<CaseStatus>> {
    try {
      // Validate receipt number format
      const validation = this.validateReceiptNumber(receiptNumber);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid receipt number: ${validation.errors?.join(', ')}`
        };
      }

      console.log(`🔍 Fetching case status for: ${receiptNumber}`);

      // Make request to USCIS case status page
      const response = await this.client.get(`/casestatus/mycasestatus.do`, {
        params: {
          appReceiptNum: receiptNumber
        }
      });

      if (response.status !== 200) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status
        };
      }

      // Parse HTML response
      const caseStatus = this.parseCaseStatusHtml(response.data, receiptNumber);
      
      if (!caseStatus) {
        return {
          success: false,
          error: 'Unable to parse case status from USCIS response'
        };
      }

      return {
        success: true,
        data: caseStatus,
        lastChecked: new Date().toISOString()
      };

    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Request timeout - USCIS service may be temporarily unavailable'
        };
      }

      if (error.response?.status === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          statusCode: 429
        };
      }

      if (error.response?.status === 503) {
        return {
          success: false,
          error: 'USCIS service temporarily unavailable',
          statusCode: 503
        };
      }

      return {
        success: false,
        error: `Failed to get case status: ${error.message}`,
        statusCode: error.response?.status
      };
    }
  }

  /**
   * Get case status for multiple receipt numbers
   */
  async getBulkCaseStatus(receiptNumbers: string[]): Promise<USCISApiResponse<CaseStatus[]>> {
    try {
      const results: CaseStatus[] = [];
      const errors: string[] = [];

      console.log(`🔍 Fetching bulk case status for ${receiptNumbers.length} cases`);

      // Process in batches to avoid overwhelming USCIS servers
      const batchSize = this.config.maxConcurrentChecks || 3;
      
      for (let i = 0; i < receiptNumbers.length; i += batchSize) {
        const batch = receiptNumbers.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (receiptNumber) => {
          const result = await this.getCaseStatus(receiptNumber);
          if (result.success && result.data) {
            results.push(result.data);
          } else {
            errors.push(`${receiptNumber}: ${result.error}`);
          }
        });

        await Promise.all(batchPromises);
        
        // Delay between batches
        if (i + batchSize < receiptNumbers.length) {
          await this.delay(5000); // 5 second delay between batches
        }
      }

      return {
        success: errors.length === 0,
        data: results,
        error: errors.length > 0 ? `Some requests failed: ${errors.join('; ')}` : undefined,
        lastChecked: new Date().toISOString()
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get bulk case status: ${error.message}`
      };
    }
  }

  /**
   * Validate USCIS receipt number format
   */
  validateReceiptNumber(receiptNumber: string): ReceiptNumberValidation {
    if (!receiptNumber) {
      return {
        isValid: false,
        errors: ['Receipt number is required']
      };
    }

    // Remove spaces and convert to uppercase
    const cleanNumber = receiptNumber.replace(/\s+/g, '').toUpperCase();

    // USCIS receipt numbers are typically 13 characters: 3 letters + 10 digits
    const receiptPattern = /^([A-Z]{3})(\d{2})(\d{3})(\d{5})$/;
    const match = cleanNumber.match(receiptPattern);

    if (!match) {
      return {
        isValid: false,
        errors: ['Invalid receipt number format. Expected format: ABC1234567890 (3 letters + 10 digits)']
      };
    }

    const [, serviceCenter, fiscalYear, dayOfYear, sequenceNumber] = match;
    
    // Map service center codes
    const serviceCenterMap: Record<string, string> = {
      'MSC': 'National Benefits Center',
      'EAC': 'Vermont Service Center',  
      'WAC': 'California Service Center',
      'LIN': 'Nebraska Service Center',
      'SRC': 'Texas Service Center',
      'NBC': 'National Benefits Center',
      'IOE': 'USCIS Electronic Immigration System',
      'YSC': 'Potomac Service Center'
    };

    // Validate service center code
    if (!serviceCenterMap[serviceCenter]) {
      return {
        isValid: false,
        errors: [`Unknown service center code: ${serviceCenter}`]
      };
    }

    // Basic fiscal year validation (should be reasonable)
    const year = parseInt(fiscalYear);
    const currentYear = new Date().getFullYear() % 100;
    if (year > currentYear + 10 || year < currentYear - 30) {
      return {
        isValid: false,
        errors: [`Invalid fiscal year: ${fiscalYear}`]
      };
    }

    return {
      isValid: true,
      serviceCenter: serviceCenterMap[serviceCenter],
      year: 2000 + year,
      sequenceNumber: sequenceNumber
    };
  }

  /**
   * Parse USCIS HTML response to extract case status information
   */
  private parseCaseStatusHtml(html: string, receiptNumber: string): CaseStatus | null {
    try {
      const $ = cheerio.load(html);
      
      // Look for the main status container
      const statusContainer = $('.appointment-info, .current-status-sec, .rows');
      
      if (statusContainer.length === 0) {
        // Check for error messages
        const errorMsg = $('.errorMessage, .error, .alert').text().trim();
        if (errorMsg) {
          throw new Error(errorMsg);
        }
        return null;
      }

      // Extract current status
      const currentStatus = $('.current-status, .appointment-info h1, h1').first().text().trim() || 'Unknown';
      
      // Extract status description
      const statusDescription = $('.status-description, .appointment-info p, p').first().text().trim() || '';
      
      // Extract dates (look for various date patterns)
      const statusDate = this.extractDateFromText(statusDescription) || new Date().toISOString();
      
      // Extract additional information
      const caseType = this.extractCaseType(statusDescription, receiptNumber);
      const formType = this.extractFormType(statusDescription, receiptNumber);
      
      // Look for next action information
      const nextActionText = $('.next-action, .appointment-details, .additional-info').text();
      const nextActionDate = this.extractDateFromText(nextActionText);
      
      // Extract service center from receipt number
      const validation = this.validateReceiptNumber(receiptNumber);
      const serviceCenter = validation.serviceCenter;

      const caseStatus: CaseStatus = {
        receiptNumber,
        caseType,
        currentStatus,
        statusDate,
        statusDescription,
        lastUpdated: new Date().toISOString(),
        formType,
        serviceCenter,
        nextActionDate,
        nextActionDescription: nextActionDate ? nextActionText.trim() : undefined
      };

      // Extract specific dates based on status
      if (currentStatus.toLowerCase().includes('interview')) {
        caseStatus.scheduledInterviewDate = this.extractDateFromText(statusDescription);
      } else if (currentStatus.toLowerCase().includes('biometric')) {
        caseStatus.biometricsDate = this.extractDateFromText(statusDescription);
      } else if (currentStatus.toLowerCase().includes('card') && currentStatus.toLowerCase().includes('produced')) {
        caseStatus.cardProductionDate = this.extractDateFromText(statusDescription);
      } else if (currentStatus.toLowerCase().includes('approved')) {
        caseStatus.decisionDate = this.extractDateFromText(statusDescription);
      }

      console.log(`✅ Parsed case status for ${receiptNumber}: ${currentStatus}`);
      
      return caseStatus;

    } catch (error: any) {
      console.error(`Failed to parse case status HTML for ${receiptNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Extract date from text using various patterns
   */
  private extractDateFromText(text: string): string | undefined {
    if (!text) return undefined;

    // Common date patterns in USCIS responses
    const datePatterns = [
      /(\w+\s+\d{1,2},\s+\d{4})/g, // March 15, 2024
      /(\d{1,2}\/\d{1,2}\/\d{4})/g, // 03/15/2024
      /(\d{1,2}-\d{1,2}-\d{4})/g,   // 03-15-2024
      /(\w+\s+\d{1,2}\s+\d{4})/g    // March 15 2024
    ];

    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        const dateStr = matches[0];
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString();
        }
      }
    }

    return undefined;
  }

  /**
   * Extract case type from status description
   */
  private extractCaseType(description: string, receiptNumber: string): string {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('adjustment of status') || lowerDesc.includes('i-485')) {
      return 'Adjustment of Status';
    } else if (lowerDesc.includes('naturalization') || lowerDesc.includes('n-400')) {
      return 'Naturalization';
    } else if (lowerDesc.includes('family-based') || lowerDesc.includes('i-130')) {
      return 'Family-Based Petition';
    } else if (lowerDesc.includes('employment') || lowerDesc.includes('i-140')) {
      return 'Employment-Based Petition';
    } else if (lowerDesc.includes('asylum') || lowerDesc.includes('i-589')) {
      return 'Asylum Application';
    } else if (lowerDesc.includes('work authorization') || lowerDesc.includes('i-765')) {
      return 'Work Authorization';
    } else if (lowerDesc.includes('travel document') || lowerDesc.includes('i-131')) {
      return 'Travel Document';
    }

    // Try to infer from receipt number service center
    const validation = this.validateReceiptNumber(receiptNumber);
    if (validation.serviceCenter?.includes('Benefits')) {
      return 'Benefits Application';
    }

    return 'Immigration Case';
  }

  /**
   * Extract form type from status description
   */
  private extractFormType(description: string, receiptNumber: string): string | undefined {
    const formPatterns = [
      /I-\d{3}/gi,  // I-485, I-130, etc.
      /N-\d{3}/gi,  // N-400, etc.
      /G-\d{3}/gi   // G-28, etc.
    ];

    for (const pattern of formPatterns) {
      const matches = description.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0].toUpperCase();
      }
    }

    return undefined;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}