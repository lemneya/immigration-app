import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import dotenv from 'dotenv';
import { SignatureService } from './services/signatureService';
import { TemplateService } from './services/templateService';
import { DocuSealClient } from './services/docusealClient';
import { SignatureServiceConfig } from './types';

// Load environment variables
dotenv.config();

// Configuration
const config: SignatureServiceConfig = {
  docusealUrl: process.env.DOCUSEAL_URL || 'http://localhost:3002',
  apiKey: process.env.DOCUSEAL_API_KEY || 'dev_api_key',
  webhookSecret: process.env.DOCUSEAL_WEBHOOK_SECRET,
  defaultExpirationDays: parseInt(process.env.DEFAULT_EXPIRATION_DAYS || '30'),
  defaultReminderInterval: parseInt(process.env.DEFAULT_REMINDER_INTERVAL || '7'),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,doc').split(',')
};

// Initialize services
const docusealClient = new DocuSealClient(config);
const signatureService = new SignatureService(config);
const templateService = new TemplateService(config, docusealClient);

// Express app
const app = express();
const port = process.env.PORT || 3005;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    const fileExt = file.originalname.split('.').pop()?.toLowerCase();
    if (fileExt && config.allowedFileTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${config.allowedFileTypes.join(', ')}`));
    }
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'e-signature-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ============================================================================
// SIGNATURE REQUEST ENDPOINTS
// ============================================================================

/**
 * Create a new signature request
 */
app.post('/signatures/requests', upload.single('document'), async (req, res) => {
  try {
    const { 
      title, 
      message, 
      signers, 
      templateId, 
      documentUrl,
      dueDate,
      reminderEnabled,
      metadata 
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    if (!signers || !Array.isArray(signers) || signers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one signer is required'
      });
    }

    // Validate signers
    for (const signer of signers) {
      if (!signer.name || !signer.email) {
        return res.status(400).json({
          success: false,
          error: 'All signers must have name and email'
        });
      }
    }

    // Check if we have a document source
    if (!templateId && !documentUrl && !req.file) {
      return res.status(400).json({
        success: false,
        error: 'Must provide either templateId, documentUrl, or upload a document'
      });
    }

    // Parse signers if it's a string
    const parsedSigners = typeof signers === 'string' ? JSON.parse(signers) : signers;
    const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;

    // Create signature request
    const result = await signatureService.createSignatureRequest({
      title,
      message,
      signers: parsedSigners,
      templateId,
      documentUrl,
      documentBuffer: req.file?.buffer,
      filename: req.file?.originalname,
      dueDate,
      reminderEnabled: reminderEnabled !== undefined ? reminderEnabled === 'true' : undefined,
      metadata: parsedMetadata
    });

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data,
        message: 'Signature request created successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error creating signature request:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get all signature requests
 */
app.get('/signatures/requests', async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    
    const result = await signatureService.getSignatureRequests(
      status as any,
      limit ? parseInt(limit as string) : undefined,
      offset ? parseInt(offset as string) : undefined
    );

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        pagination: {
          limit: limit ? parseInt(limit as string) : null,
          offset: offset ? parseInt(offset as string) : null
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error getting signature requests:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get a specific signature request
 */
app.get('/signatures/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await signatureService.getSignatureRequest(id);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error getting signature request:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Cancel a signature request
 */
app.post('/signatures/requests/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await signatureService.cancelSignatureRequest(id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Signature request cancelled successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error cancelling signature request:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Send reminder to a signer
 */
app.post('/signatures/requests/:id/signers/:signerId/remind', async (req, res) => {
  try {
    const { id, signerId } = req.params;
    
    const result = await signatureService.sendReminder(id, signerId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Reminder sent successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error sending reminder:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Download signed document
 */
app.get('/signatures/requests/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await signatureService.downloadDocument(id);

    if (result.success && result.data) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="signed-document-${id}.pdf"`);
      res.send(result.data);
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error downloading document:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ============================================================================
// ANALYTICS ENDPOINTS
// ============================================================================

/**
 * Get signature analytics
 */
app.get('/signatures/analytics', async (req, res) => {
  try {
    const result = await signatureService.getAnalytics();

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ============================================================================
// WEBHOOK ENDPOINTS
// ============================================================================

/**
 * Handle DocuSeal webhooks
 */
app.post('/signatures/webhooks/docuseal', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify webhook signature if secret is configured
    if (config.webhookSecret) {
      const signature = req.headers['x-signature'] as string;
      // In a production environment, you would verify the webhook signature here
      // For now, we'll just log it
      console.log('Webhook signature:', signature);
    }

    // Parse payload
    const payload = JSON.parse(req.body.toString());
    console.log('DocuSeal webhook received:', payload);

    // Handle the webhook
    const result = await signatureService.handleWebhook(payload);

    if (result.success) {
      res.json({ success: true });
    } else {
      console.error('Webhook handling failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error handling webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ============================================================================
// TEMPLATE ENDPOINTS
// ============================================================================

/**
 * Get all signature templates
 */
app.get('/signatures/templates', async (req, res) => {
  try {
    const result = await templateService.getTemplates();

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get a specific template
 */
app.get('/signatures/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await templateService.getTemplate(id);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error getting template:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Create a new signature template
 */
app.post('/signatures/templates', upload.single('document'), async (req, res) => {
  try {
    const { name, description, formType } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Template name is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Document file is required'
      });
    }

    const result = await templateService.createTemplate(
      name,
      description || '',
      req.file.buffer,
      req.file.originalname,
      formType
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data,
        message: 'Template created successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update a signature template
 */
app.put('/signatures/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const result = await templateService.updateTemplate(id, updates);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: 'Template updated successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Delete a signature template
 */
app.delete('/signatures/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await templateService.deleteTemplate(id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get templates by form type
 */
app.get('/signatures/templates/form/:formType', async (req, res) => {
  try {
    const { formType } = req.params;

    const result = await templateService.getTemplatesByFormType(formType);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error getting templates by form type:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ============================================================================
// INTEGRATION ENDPOINTS
// ============================================================================

/**
 * Create signature request from filled PDF
 */
app.post('/signatures/from-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const { title, signers, message, dueDate } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'PDF file is required'
      });
    }

    if (!title || !signers) {
      return res.status(400).json({
        success: false,
        error: 'Title and signers are required'
      });
    }

    const parsedSigners = typeof signers === 'string' ? JSON.parse(signers) : signers;

    const result = await signatureService.createSignatureRequest({
      title,
      message,
      signers: parsedSigners,
      documentBuffer: req.file.buffer,
      filename: req.file.originalname,
      dueDate,
      metadata: {
        source: 'pdf-fill-service',
        originalFilename: req.file.originalname
      }
    });

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data,
        message: 'Signature request created from PDF successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Error creating signature request from PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size is ${config.maxFileSize / (1024 * 1024)}MB`
      });
    }
  }

  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
const server = app.listen(port, () => {
  console.log(`✍️  E-signature service running on port ${port}`);
  console.log(`📝 DocuSeal URL: ${config.docusealUrl}`);
  console.log(`🔗 Ready to process signature requests`);
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${port} is already in use, trying ${Number(port) + 1}`);
    app.listen(Number(port) + 1, () => {
      console.log(`✍️  E-signature service running on port ${Number(port) + 1}`);
      console.log(`📝 DocuSeal URL: ${config.docusealUrl}`);
      console.log(`🔗 Ready to process signature requests`);
    });
  } else {
    console.error('Server error:', err);
  }
});

export default app;