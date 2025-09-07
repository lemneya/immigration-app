import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { PDFFormFiller } from './services/pdfFormFiller';
import { FormTemplateManager } from './services/templateManager';
import { FieldMappingService } from './services/fieldMapping';
import { ValidationService } from './services/validation';

dotenv.config();

const app = express();
const port = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 50 * 1024 * 1024 // 50MB limit for PDF files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  }
});

// Initialize services
const templateManager = new FormTemplateManager();
const fieldMappingService = new FieldMappingService();
const validationService = new ValidationService();
const pdfFormFiller = new PDFFormFiller(templateManager, fieldMappingService);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'pdf-fill-service',
    timestamp: new Date().toISOString()
  });
});

// Get available form templates
app.get('/forms/templates', async (req, res) => {
  try {
    const templates = await templateManager.getAvailableTemplates();
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error retrieving templates:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve form templates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get form template information
app.get('/forms/templates/:formType', async (req, res) => {
  try {
    const { formType } = req.params;
    const template = await templateManager.getTemplate(formType);
    
    if (!template) {
      return res.status(404).json({
        error: 'Form template not found',
        formType
      });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Error retrieving template:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve template information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Fill PDF form with canonical data
app.post('/forms/fill/:formType', async (req, res) => {
  try {
    const { formType } = req.params;
    const { canonicalData, options = {} } = req.body;

    if (!canonicalData) {
      return res.status(400).json({
        error: 'Canonical data is required'
      });
    }

    // Validate canonical data
    const validationResult = await validationService.validateCanonicalData(canonicalData, formType);
    if (!validationResult.isValid) {
      return res.status(400).json({
        error: 'Invalid canonical data',
        validation_errors: validationResult.errors
      });
    }

    // Fill the PDF form
    const result = await pdfFormFiller.fillForm(formType, canonicalData, {
      flatten: options.flatten !== false, // Default to true
      includeMetadata: options.includeMetadata !== false,
      validateFields: options.validateFields !== false,
      ...options
    });

    // Return filled PDF as base64
    res.json({
      success: true,
      form_type: formType,
      pdf_data: result.pdfBuffer.toString('base64'),
      metadata: result.metadata,
      field_mappings: result.fieldMappings,
      validation_results: result.validationResults
    });

  } catch (error) {
    console.error('PDF fill error:', error);
    res.status(500).json({ 
      error: 'Failed to fill PDF form',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Fill PDF form from uploaded template
app.post('/forms/fill-custom', upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF template file is required' });
    }

    const { canonicalData, fieldMappings, options = {} } = req.body;

    if (!canonicalData) {
      return res.status(400).json({
        error: 'Canonical data is required'
      });
    }

    let parsedCanonicalData;
    let parsedFieldMappings;

    try {
      parsedCanonicalData = typeof canonicalData === 'string' ? JSON.parse(canonicalData) : canonicalData;
      parsedFieldMappings = fieldMappings ? (typeof fieldMappings === 'string' ? JSON.parse(fieldMappings) : fieldMappings) : {};
    } catch (parseError) {
      return res.status(400).json({
        error: 'Invalid JSON in request data'
      });
    }

    // Fill custom PDF template
    const result = await pdfFormFiller.fillCustomForm(
      req.file.buffer, 
      parsedCanonicalData,
      parsedFieldMappings,
      {
        flatten: options.flatten !== false,
        includeMetadata: options.includeMetadata !== false,
        validateFields: options.validateFields !== false
      }
    );

    res.json({
      success: true,
      pdf_data: result.pdfBuffer.toString('base64'),
      metadata: result.metadata,
      field_mappings: result.fieldMappings,
      validation_results: result.validationResults
    });

  } catch (error) {
    console.error('Custom PDF fill error:', error);
    res.status(500).json({ 
      error: 'Failed to fill custom PDF form',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Preview PDF form fields (without filling)
app.post('/forms/preview/:formType', async (req, res) => {
  try {
    const { formType } = req.params;
    const { canonicalData } = req.body;

    const preview = await pdfFormFiller.previewFormFields(formType, canonicalData);

    res.json({
      success: true,
      form_type: formType,
      field_preview: preview.fieldPreview,
      mapping_info: preview.mappingInfo,
      validation_info: preview.validationInfo
    });

  } catch (error) {
    console.error('PDF preview error:', error);
    res.status(500).json({ 
      error: 'Failed to preview PDF form',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get form field information for a specific form type
app.get('/forms/fields/:formType', async (req, res) => {
  try {
    const { formType } = req.params;
    
    const fields = await pdfFormFiller.getFormFields(formType);
    
    res.json({
      success: true,
      form_type: formType,
      fields
    });

  } catch (error) {
    console.error('Error getting form fields:', error);
    res.status(500).json({ 
      error: 'Failed to get form fields',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Batch fill multiple forms
app.post('/forms/batch-fill', async (req, res) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        error: 'Requests array is required and cannot be empty'
      });
    }

    const results = [];
    
    for (const request of requests) {
      try {
        const { formType, canonicalData, options = {} } = request;
        
        const result = await pdfFormFiller.fillForm(formType, canonicalData, options);
        
        results.push({
          success: true,
          form_type: formType,
          pdf_data: result.pdfBuffer.toString('base64'),
          metadata: result.metadata
        });
      } catch (error) {
        results.push({
          success: false,
          form_type: request.formType,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      results,
      total_processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

  } catch (error) {
    console.error('Batch fill error:', error);
    res.status(500).json({ 
      error: 'Failed to process batch fill request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`📝 PDF Fill Service running on port ${port}`);
  console.log(`🗂️  Ready to fill USCIS forms with canonical data`);
});