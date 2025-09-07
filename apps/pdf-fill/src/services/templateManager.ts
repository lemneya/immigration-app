import fs from 'fs/promises';
import path from 'path';

export interface FormTemplate {
  formType: string;
  name: string;
  description: string;
  version: string;
  filePath: string;
  lastUpdated: string;
  officialUrl?: string;
  formFields?: number;
  pages?: number;
}

export class FormTemplateManager {
  private templatesPath: string;
  private templateCache: Map<string, Buffer> = new Map();
  private templates: Map<string, FormTemplate> = new Map();

  constructor() {
    this.templatesPath = path.join(__dirname, '../../templates');
    this.initializeTemplates();
  }

  async getAvailableTemplates(): Promise<FormTemplate[]> {
    return Array.from(this.templates.values());
  }

  async getTemplate(formType: string): Promise<FormTemplate | null> {
    return this.templates.get(formType) || null;
  }

  async getTemplateBuffer(formType: string): Promise<Buffer | null> {
    // Check cache first
    if (this.templateCache.has(formType)) {
      return this.templateCache.get(formType)!;
    }

    const template = this.templates.get(formType);
    if (!template) {
      return null;
    }

    try {
      const buffer = await fs.readFile(template.filePath);
      this.templateCache.set(formType, buffer);
      return buffer;
    } catch (error) {
      console.error(`Failed to load template ${formType}:`, error);
      return null;
    }
  }

  async addTemplate(formType: string, templateBuffer: Buffer, metadata: Partial<FormTemplate>): Promise<void> {
    const templatePath = path.join(this.templatesPath, `${formType}.pdf`);
    
    try {
      // Ensure templates directory exists
      await fs.mkdir(path.dirname(templatePath), { recursive: true });
      
      // Write template file
      await fs.writeFile(templatePath, templateBuffer);
      
      // Add to templates map
      const template: FormTemplate = {
        formType,
        name: metadata.name || formType.toUpperCase(),
        description: metadata.description || `USCIS Form ${formType.toUpperCase()}`,
        version: metadata.version || '1.0',
        filePath: templatePath,
        lastUpdated: new Date().toISOString(),
        officialUrl: metadata.officialUrl,
        formFields: metadata.formFields,
        pages: metadata.pages
      };

      this.templates.set(formType, template);
      this.templateCache.set(formType, templateBuffer);

      // Save template metadata
      await this.saveTemplateMetadata();

    } catch (error) {
      throw new Error(`Failed to add template ${formType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateTemplate(formType: string, templateBuffer: Buffer, metadata: Partial<FormTemplate>): Promise<void> {
    const existingTemplate = this.templates.get(formType);
    if (!existingTemplate) {
      throw new Error(`Template ${formType} does not exist`);
    }

    await this.addTemplate(formType, templateBuffer, {
      ...existingTemplate,
      ...metadata,
      lastUpdated: new Date().toISOString()
    });
  }

  async removeTemplate(formType: string): Promise<void> {
    const template = this.templates.get(formType);
    if (!template) {
      throw new Error(`Template ${formType} does not exist`);
    }

    try {
      // Remove file
      await fs.unlink(template.filePath);
      
      // Remove from maps
      this.templates.delete(formType);
      this.templateCache.delete(formType);

      // Save updated metadata
      await this.saveTemplateMetadata();

    } catch (error) {
      throw new Error(`Failed to remove template ${formType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async initializeTemplates(): Promise<void> {
    try {
      // Ensure templates directory exists
      await fs.mkdir(this.templatesPath, { recursive: true });

      // Load existing template metadata
      await this.loadTemplateMetadata();

      // Create default templates if none exist
      if (this.templates.size === 0) {
        await this.createDefaultTemplates();
      }

    } catch (error) {
      console.error('Failed to initialize templates:', error);
      // Create default templates as fallback
      await this.createDefaultTemplates();
    }
  }

  private async loadTemplateMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(this.templatesPath, 'templates.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      for (const template of metadata.templates || []) {
        // Verify template file exists
        try {
          await fs.access(template.filePath);
          this.templates.set(template.formType, template);
        } catch {
          console.warn(`Template file not found: ${template.filePath}`);
        }
      }

    } catch (error) {
      console.log('No existing template metadata found, will create defaults');
    }
  }

  private async saveTemplateMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(this.templatesPath, 'templates.json');
      const metadata = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        templates: Array.from(this.templates.values())
      };

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    } catch (error) {
      console.error('Failed to save template metadata:', error);
    }
  }

  private async createDefaultTemplates(): Promise<void> {
    // Create mock PDF templates for development
    const defaultTemplates = [
      {
        formType: 'i485',
        name: 'Form I-485',
        description: 'Application to Register Permanent Residence or Adjust Status',
        officialUrl: 'https://www.uscis.gov/i-485',
        pages: 14,
        formFields: 89
      },
      {
        formType: 'i130',
        name: 'Form I-130',
        description: 'Petition for Alien Relative',
        officialUrl: 'https://www.uscis.gov/i-130',
        pages: 12,
        formFields: 67
      },
      {
        formType: 'i131',
        name: 'Form I-131',
        description: 'Application for Travel Document',
        officialUrl: 'https://www.uscis.gov/i-131',
        pages: 8,
        formFields: 45
      },
      {
        formType: 'g28',
        name: 'Form G-28',
        description: 'Notice of Entry of Appearance as Attorney or Accredited Representative',
        officialUrl: 'https://www.uscis.gov/g-28',
        pages: 2,
        formFields: 23
      }
    ];

    for (const templateInfo of defaultTemplates) {
      try {
        // Create a simple mock PDF for development
        const mockPDF = await this.createMockPDF(templateInfo.formType, templateInfo.name);
        
        const templatePath = path.join(this.templatesPath, `${templateInfo.formType}.pdf`);
        await fs.writeFile(templatePath, mockPDF);

        const template: FormTemplate = {
          ...templateInfo,
          version: '1.0',
          filePath: templatePath,
          lastUpdated: new Date().toISOString()
        };

        this.templates.set(templateInfo.formType, template);

      } catch (error) {
        console.error(`Failed to create default template ${templateInfo.formType}:`, error);
      }
    }

    await this.saveTemplateMetadata();
    console.log(`Created ${this.templates.size} default form templates`);
  }

  private async createMockPDF(formType: string, formName: string): Promise<Buffer> {
    // Import pdf-lib dynamically to create a simple form
    const { PDFDocument, StandardFonts } = await import('pdf-lib');

    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const page = pdfDoc.addPage([612, 792]); // US Letter size

    // Add form title
    page.drawText(formName, {
      x: 50,
      y: 750,
      size: 16,
      font: timesRomanFont
    });

    page.drawText(`USCIS Form ${formType.toUpperCase()}`, {
      x: 50,
      y: 720,
      size: 14,
      font: timesRomanFont
    });

    // Add some mock form fields based on form type
    const mockFields = this.getMockFieldsForForm(formType);
    let yPosition = 680;

    const form = pdfDoc.getForm();

    for (const field of mockFields) {
      // Add label
      page.drawText(field.label + ':', {
        x: 50,
        y: yPosition,
        size: 10,
        font: timesRomanFont
      });

      // Add form field with proper font configuration
      if (field.type === 'text') {
        const textField = form.createTextField(field.name);
        textField.setFontAndSize(timesRomanFont, 10);
        textField.setText('');
        textField.enableReadOnly(false);
      } else if (field.type === 'checkbox') {
        const checkBox = form.createCheckBox(field.name);
        checkBox.uncheck();
        checkBox.enableReadOnly(false);
      }

      yPosition -= 25;

      if (yPosition < 100) {
        // Add new page if needed
        const newPage = pdfDoc.addPage([612, 792]);
        yPosition = 750;
      }
    }

    // Add footer
    const pageCount = pdfDoc.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const currentPage = pdfDoc.getPage(i);
      currentPage.drawText(`Mock Template - Page ${i + 1} of ${pageCount}`, {
        x: 50,
        y: 50,
        size: 8,
        font: timesRomanFont
      });
    }

    return Buffer.from(await pdfDoc.save());
  }

  private getMockFieldsForForm(formType: string): Array<{ name: string; label: string; type: string }> {
    const commonFields = [
      { name: 'given_name', label: 'Given Name (First Name)', type: 'text' },
      { name: 'family_name', label: 'Family Name (Last Name)', type: 'text' },
      { name: 'middle_name', label: 'Middle Name', type: 'text' },
      { name: 'date_of_birth', label: 'Date of Birth (MM/DD/YYYY)', type: 'text' },
      { name: 'country_of_birth', label: 'Country of Birth', type: 'text' },
      { name: 'current_address_street', label: 'Current Physical Address - Street Number and Name', type: 'text' },
      { name: 'current_address_city', label: 'City or Town', type: 'text' },
      { name: 'current_address_state', label: 'State', type: 'text' },
      { name: 'current_address_zipcode', label: 'ZIP Code', type: 'text' },
      { name: 'email', label: 'Email Address', type: 'text' },
      { name: 'phone', label: 'Daytime Telephone Number', type: 'text' }
    ];

    switch (formType) {
      case 'i485':
        return [
          ...commonFields,
          { name: 'a_number', label: 'A-Number (if any)', type: 'text' },
          { name: 'uscis_account', label: 'USCIS Online Account Number', type: 'text' },
          { name: 'application_type', label: 'I am applying for adjustment to permanent resident status because', type: 'checkbox' },
          { name: 'current_immigration_status', label: 'Current Immigration Status', type: 'text' }
        ];

      case 'i130':
        return [
          ...commonFields,
          { name: 'petitioner_citizen', label: 'I am a U.S. citizen', type: 'checkbox' },
          { name: 'petitioner_lpr', label: 'I am a lawful permanent resident', type: 'checkbox' },
          { name: 'beneficiary_given_name', label: 'Beneficiary Given Name', type: 'text' },
          { name: 'beneficiary_family_name', label: 'Beneficiary Family Name', type: 'text' },
          { name: 'relationship', label: 'Relationship to Petitioner', type: 'text' }
        ];

      case 'i131':
        return [
          ...commonFields,
          { name: 'document_type_reentry', label: 'Re-entry Permit', type: 'checkbox' },
          { name: 'document_type_refugee', label: 'Refugee Travel Document', type: 'checkbox' },
          { name: 'document_type_advance_parole', label: 'Advance Parole Document', type: 'checkbox' }
        ];

      case 'g28':
        return [
          { name: 'attorney_name', label: 'Attorney or Accredited Representative Name', type: 'text' },
          { name: 'attorney_bar_number', label: 'State Bar Number', type: 'text' },
          { name: 'attorney_address', label: 'Attorney Address', type: 'text' },
          { name: 'attorney_phone', label: 'Attorney Phone Number', type: 'text' },
          { name: 'client_name', label: 'Name of Person or Organization', type: 'text' },
          { name: 'client_case_number', label: 'USCIS Receipt Number', type: 'text' }
        ];

      default:
        return commonFields;
    }
  }
}