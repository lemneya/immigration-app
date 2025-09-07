import { v4 as uuidv4 } from 'uuid';
import { 
  SignatureTemplate, 
  SignatureField, 
  TemplateSettings, 
  SignatureServiceConfig 
} from '../types';
import { DocuSealClient, CreateTemplateRequest } from './docusealClient';

export class TemplateService {
  private docusealClient: DocuSealClient;
  private config: SignatureServiceConfig;
  private templates: Map<string, SignatureTemplate> = new Map();

  constructor(config: SignatureServiceConfig, docusealClient: DocuSealClient) {
    this.config = config;
    this.docusealClient = docusealClient;
    this.initializeDefaultTemplates();
  }

  /**
   * Get all signature templates
   */
  async getTemplates(): Promise<{ success: boolean; data?: SignatureTemplate[]; error?: string }> {
    try {
      // Sync with DocuSeal templates
      const docusealResponse = await this.docusealClient.getTemplates();
      
      if (docusealResponse.success && docusealResponse.data) {
        // Update local templates with DocuSeal data
        for (const docusealTemplate of docusealResponse.data) {
          const existingTemplate = Array.from(this.templates.values())
            .find(t => t.name === docusealTemplate.name);
          
          if (existingTemplate) {
            // Update existing template with DocuSeal data
            existingTemplate.documentUrl = docusealTemplate.documents[0]?.url || '';
            existingTemplate.updatedAt = docusealTemplate.updated_at;
          }
        }
      }

      return {
        success: true,
        data: Array.from(this.templates.values()).filter(t => t.isActive)
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get templates: ${error.message}`
      };
    }
  }

  /**
   * Get a specific template
   */
  async getTemplate(templateId: string): Promise<{ success: boolean; data?: SignatureTemplate; error?: string }> {
    try {
      const template = this.templates.get(templateId);
      
      if (!template) {
        return {
          success: false,
          error: 'Template not found'
        };
      }

      return {
        success: true,
        data: template
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get template: ${error.message}`
      };
    }
  }

  /**
   * Create a new signature template
   */
  async createTemplate(
    name: string,
    description: string,
    documentBuffer: Buffer,
    filename: string,
    formType?: string
  ): Promise<{ success: boolean; data?: SignatureTemplate; error?: string }> {
    try {
      const templateId = uuidv4();
      const now = new Date().toISOString();

      // Create template in DocuSeal
      const docusealRequest: CreateTemplateRequest = {
        name,
        documents: [{
          name: filename,
          file: documentBuffer
        }],
        submitters: this.getDefaultSubmitters(formType),
        fields: this.getDefaultFields(formType),
        folder_name: 'Immigration Suite',
        external_id: templateId
      };

      const docusealResponse = await this.docusealClient.createTemplate(docusealRequest);
      
      if (!docusealResponse.success || !docusealResponse.data) {
        return {
          success: false,
          error: `Failed to create DocuSeal template: ${docusealResponse.error}`
        };
      }

      // Create local template
      const template: SignatureTemplate = {
        id: templateId,
        name,
        description,
        formType,
        // @ts-ignore
        documentUrl: docusealResponse.data.documents[0]?.url || '',
        // @ts-ignore
        fields: this.convertDocuSealFields(docusealResponse.data.fields || []),
        defaultSigners: this.getDefaultSigners(formType),
        settings: this.getDefaultSettings(),
        createdAt: now,
        updatedAt: now,
        isActive: true
      };

      // Store template
      this.templates.set(templateId, template);

      return {
        success: true,
        data: template
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to create template: ${error.message}`
      };
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<Pick<SignatureTemplate, 'name' | 'description' | 'fields' | 'defaultSigners' | 'settings'>>
  ): Promise<{ success: boolean; data?: SignatureTemplate; error?: string }> {
    try {
      const template = this.templates.get(templateId);
      
      if (!template) {
        return {
          success: false,
          error: 'Template not found'
        };
      }

      // Update template
      const updatedTemplate = {
        ...template,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      this.templates.set(templateId, updatedTemplate);

      return {
        success: true,
        data: updatedTemplate
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to update template: ${error.message}`
      };
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const template = this.templates.get(templateId);
      
      if (!template) {
        return {
          success: false,
          error: 'Template not found'
        };
      }

      // Mark as inactive instead of deleting
      template.isActive = false;
      template.updatedAt = new Date().toISOString();
      this.templates.set(templateId, template);

      return {
        success: true
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to delete template: ${error.message}`
      };
    }
  }

  /**
   * Get templates by form type
   */
  async getTemplatesByFormType(formType: string): Promise<{ success: boolean; data?: SignatureTemplate[]; error?: string }> {
    try {
      const templates = Array.from(this.templates.values())
        .filter(t => t.formType === formType && t.isActive);

      return {
        success: true,
        data: templates
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get templates by form type: ${error.message}`
      };
    }
  }

  /**
   * Initialize default templates for common immigration forms
   */
  private async initializeDefaultTemplates(): Promise<void> {
    console.log('🖊️  Initializing signature templates...');
    
    const defaultTemplates = [
      {
        id: 'i485-signature',
        name: 'I-485 Signature Template',
        description: 'Signature fields for Form I-485 (Application to Register Permanent Residence)',
        formType: 'i485',
        fields: this.getI485SignatureFields(),
        defaultSigners: [
          {
            name: 'Applicant',
            email: '',
            role: 'applicant'
          }
        ]
      },
      {
        id: 'i130-signature', 
        name: 'I-130 Signature Template',
        description: 'Signature fields for Form I-130 (Petition for Alien Relative)',
        formType: 'i130',
        fields: this.getI130SignatureFields(),
        defaultSigners: [
          {
            name: 'Petitioner',
            email: '',
            role: 'petitioner'
          }
        ]
      },
      {
        id: 'g28-signature',
        name: 'G-28 Signature Template',
        description: 'Signature fields for Form G-28 (Notice of Entry of Appearance)',
        formType: 'g28',
        fields: this.getG28SignatureFields(),
        defaultSigners: [
          {
            name: 'Attorney',
            email: '',
            role: 'attorney'
          },
          {
            name: 'Client',
            email: '',
            role: 'client'
          }
        ]
      }
    ];

    const now = new Date().toISOString();
    
    for (const templateData of defaultTemplates) {
      const template: SignatureTemplate = {
        ...templateData,
        documentUrl: '', // Would be set when document is uploaded
        settings: this.getDefaultSettings(),
        createdAt: now,
        updatedAt: now,
        isActive: true
      };

      this.templates.set(template.id, template);
    }

    console.log(`📝 Created ${defaultTemplates.length} default signature templates`);
  }

  /**
   * Get default submitters based on form type
   */
  private getDefaultSubmitters(formType?: string): Array<{ name: string; role?: string }> {
    switch (formType) {
      case 'i485':
        return [{ name: 'Applicant', role: 'applicant' }];
      case 'i130':
        return [{ name: 'Petitioner', role: 'petitioner' }];
      case 'g28':
        return [
          { name: 'Attorney', role: 'attorney' },
          { name: 'Client', role: 'client' }
        ];
      default:
        return [{ name: 'Signer', role: 'signer' }];
    }
  }

  /**
   * Get default signers based on form type
   */
  private getDefaultSigners(formType?: string) {
    return this.getDefaultSubmitters(formType).map(submitter => ({
      ...submitter,
      email: ''
    }));
  }

  /**
   * Get default fields based on form type
   */
  private getDefaultFields(formType?: string) {
    switch (formType) {
      case 'i485':
        return this.convertToDocuSealFields(this.getI485SignatureFields());
      case 'i130':
        return this.convertToDocuSealFields(this.getI130SignatureFields());
      case 'g28':
        return this.convertToDocuSealFields(this.getG28SignatureFields());
      default:
        return [];
    }
  }

  /**
   * Convert our signature fields to DocuSeal format
   */
  private convertToDocuSealFields(fields: SignatureField[]) {
    return fields.map(field => ({
      name: field.name,
      type: field.type,
      submitter: 'Signer', // Default submitter name
      page: field.page - 1, // DocuSeal uses 0-based page indexing
      areas: [{
        x: field.x,
        y: field.y,
        w: field.width,
        h: field.height
      }],
      required: field.required,
      default_value: field.defaultValue,
      options: field.options
    }));
  }

  /**
   * Convert DocuSeal fields to our format
   */
  private convertDocuSealFields(docusealFields: any[]): SignatureField[] {
    return docusealFields.map((field, index) => ({
      id: field.uuid || `field_${index}`,
      type: field.type as any,
      name: field.name,
      page: (field.page || 0) + 1, // Convert to 1-based indexing
      x: field.areas?.[0]?.x || 0,
      y: field.areas?.[0]?.y || 0,
      width: field.areas?.[0]?.w || 100,
      height: field.areas?.[0]?.h || 30,
      required: field.required || false,
      defaultValue: field.default_value,
      options: field.options
    }));
  }

  /**
   * Get default template settings
   */
  private getDefaultSettings(): TemplateSettings {
    return {
      allowDecline: true,
      requireAllSigners: true,
      sendReminders: true,
      reminderInterval: this.config.defaultReminderInterval,
      expirationDays: this.config.defaultExpirationDays,
      allowComments: false,
      requireAuthentication: false
    };
  }

  /**
   * Get I-485 specific signature fields
   */
  private getI485SignatureFields(): SignatureField[] {
    return [
      {
        id: 'applicant_signature',
        type: 'signature',
        name: 'applicant_signature',
        page: 14, // Last page of I-485
        x: 50,
        y: 600,
        width: 200,
        height: 40,
        required: true
      },
      {
        id: 'applicant_date',
        type: 'date',
        name: 'signature_date',
        page: 14,
        x: 300,
        y: 600,
        width: 100,
        height: 30,
        required: true
      }
    ];
  }

  /**
   * Get I-130 specific signature fields
   */
  private getI130SignatureFields(): SignatureField[] {
    return [
      {
        id: 'petitioner_signature',
        type: 'signature',
        name: 'petitioner_signature',
        page: 12, // Last page of I-130
        x: 50,
        y: 600,
        width: 200,
        height: 40,
        required: true
      },
      {
        id: 'petitioner_date',
        type: 'date',
        name: 'signature_date',
        page: 12,
        x: 300,
        y: 600,
        width: 100,
        height: 30,
        required: true
      }
    ];
  }

  /**
   * Get G-28 specific signature fields
   */
  private getG28SignatureFields(): SignatureField[] {
    return [
      {
        id: 'attorney_signature',
        type: 'signature',
        name: 'attorney_signature',
        page: 2,
        x: 50,
        y: 400,
        width: 200,
        height: 40,
        required: true
      },
      {
        id: 'attorney_date',
        type: 'date',
        name: 'attorney_date',
        page: 2,
        x: 300,
        y: 400,
        width: 100,
        height: 30,
        required: true
      },
      {
        id: 'client_signature',
        type: 'signature',
        name: 'client_signature',
        page: 2,
        x: 50,
        y: 500,
        width: 200,
        height: 40,
        required: true
      },
      {
        id: 'client_date',
        type: 'date',
        name: 'client_date',
        page: 2,
        x: 300,
        y: 500,
        width: 100,
        height: 30,
        required: true
      }
    ];
  }
}