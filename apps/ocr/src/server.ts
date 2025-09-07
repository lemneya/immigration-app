import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { OCRService } from './services/ocr';
import { DocumentProcessor } from './processors/documentProcessor';
import { FieldExtractor } from './extractors/fieldExtractor';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/tiff', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, TIFF, and PDF are allowed.'));
    }
  }
});

// Initialize services
const ocrService = new OCRService();
const documentProcessor = new DocumentProcessor();
const fieldExtractor = new FieldExtractor();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'ocr-service',
    timestamp: new Date().toISOString()
  });
});

// OCR endpoint for document processing
app.post('/ocr/process', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file uploaded' });
    }

    const { documentType, language = 'en' } = req.body;

    // Process the document through OCR
    const ocrResults = await ocrService.processDocument(req.file.buffer, {
      documentType,
      language,
      mimetype: req.file.mimetype
    });

    // Extract and structure fields based on document type
    const extractedFields = await fieldExtractor.extractFields(ocrResults, documentType);

    // Post-process and normalize the extracted data
    const processedData = await documentProcessor.processFields(extractedFields, {
      documentType,
      language,
      confidence_threshold: parseFloat(req.body.confidence_threshold || '0.7')
    });

    res.json({
      success: true,
      document_id: ocrResults.document_id,
      ocr_results: ocrResults,
      extracted_fields: extractedFields,
      processed_data: processedData,
      metadata: {
        processing_time: ocrResults.processing_time,
        language_detected: ocrResults.language_detected,
        pages_processed: ocrResults.pages?.length || 1,
        confidence_average: ocrResults.confidence_average
      }
    });

  } catch (error) {
    console.error('OCR processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process document',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint for text-only OCR (no field extraction)
app.post('/ocr/extract-text', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file uploaded' });
    }

    const { language = 'en' } = req.body;

    const ocrResults = await ocrService.extractText(req.file.buffer, {
      language,
      mimetype: req.file.mimetype
    });

    res.json({
      success: true,
      document_id: ocrResults.document_id,
      text: ocrResults.text,
      pages: ocrResults.pages,
      metadata: {
        processing_time: ocrResults.processing_time,
        language_detected: ocrResults.language_detected,
        confidence_average: ocrResults.confidence_average
      }
    });

  } catch (error) {
    console.error('Text extraction error:', error);
    res.status(500).json({ 
      error: 'Failed to extract text',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint to get supported document types and languages
app.get('/ocr/capabilities', (req, res) => {
  res.json({
    supported_document_types: [
      'passport',
      'id_card', 
      'birth_certificate',
      'marriage_certificate',
      'divorce_decree',
      'naturalization_certificate',
      'green_card',
      'driver_license',
      'general_document'
    ],
    supported_languages: [
      'en', 'es', 'fr', 'ar', 'zh', 'hi', 'pt', 'ru', 'ja', 'ko'
    ],
    supported_formats: [
      'image/jpeg',
      'image/png', 
      'image/tiff',
      'application/pdf'
    ],
    max_file_size: '10MB'
  });
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`🔍 OCR Service running on port ${port}`);
  console.log(`📄 Ready to process documents with PaddleOCR/docTR`);
});