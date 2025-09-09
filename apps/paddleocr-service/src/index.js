const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3023;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Multer configuration for file uploads
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|tiff|bmp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
  }
});

// Mock PaddleOCR function (in production, this would call actual PaddleOCR)
async function performOCR(imagePath, languages = ['en', 'ar']) {
  // Simulate PaddleOCR processing
  // In production, this would run: paddleocr --image_dir=${imagePath} --lang=${lang}
  
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock response with sample text in different languages
      const mockResults = {
        en: [
          { text: 'UNITED STATES CITIZENSHIP', confidence: 0.98, bbox: [[10, 10], [200, 10], [200, 30], [10, 30]] },
          { text: 'AND IMMIGRATION SERVICES', confidence: 0.97, bbox: [[10, 35], [200, 35], [200, 55], [10, 55]] },
          { text: 'Form I-485', confidence: 0.99, bbox: [[10, 60], [100, 60], [100, 80], [10, 80]] },
          { text: 'Application to Register Permanent Residence', confidence: 0.96, bbox: [[10, 85], [300, 85], [300, 105], [10, 105]] }
        ],
        ar: [
          { text: 'خدمات الهجرة والجنسية', confidence: 0.95, bbox: [[10, 110], [200, 110], [200, 130], [10, 130]] },
          { text: 'الولايات المتحدة الأمريكية', confidence: 0.94, bbox: [[10, 135], [200, 135], [200, 155], [10, 155]] },
          { text: 'نموذج I-485', confidence: 0.96, bbox: [[10, 160], [100, 160], [100, 180], [10, 180]] }
        ]
      };
      
      resolve({
        status: 'success',
        languages: languages,
        results: languages.reduce((acc, lang) => {
          acc[lang] = mockResults[lang] || [];
          return acc;
        }, {}),
        processing_time: Math.random() * 2 + 1, // 1-3 seconds
        engine: 'PaddleOCR v2.6'
      });
    }, 1500);
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'PaddleOCR Service',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// OCR endpoint
app.post('/ocr', upload.single('document'), async (req, res) => {
  let tempPath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Get languages from request or use defaults
    const languages = req.body.languages ? 
      req.body.languages.split(',').map(l => l.trim()) : 
      ['en', 'ar'];
    
    // Save uploaded file temporarily
    tempPath = path.join(os.tmpdir(), `ocr_${Date.now()}_${req.file.originalname}`);
    await fs.writeFile(tempPath, req.file.buffer);
    
    // Preprocess image if needed
    if (req.body.preprocess === 'true') {
      const processedPath = tempPath.replace(/\.[^/.]+$/, '_processed.png');
      await sharp(tempPath)
        .grayscale()
        .normalize()
        .sharpen()
        .toFile(processedPath);
      
      // Clean up original and use processed
      await fs.unlink(tempPath);
      tempPath = processedPath;
    }
    
    // Perform OCR
    const ocrResult = await performOCR(tempPath, languages);
    
    // Extract text from results
    const extractedText = {};
    for (const [lang, results] of Object.entries(ocrResult.results)) {
      extractedText[lang] = results.map(r => r.text).join(' ');
    }
    
    res.json({
      success: true,
      filename: req.file.originalname,
      languages: languages,
      text: extractedText,
      details: ocrResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'OCR processing failed'
    });
  } finally {
    // Clean up temp file
    if (tempPath) {
      try {
        await fs.unlink(tempPath);
      } catch (e) {
        console.error('Failed to clean up temp file:', e);
      }
    }
  }
});

// Batch OCR endpoint
app.post('/ocr/batch', upload.array('documents', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const languages = req.body.languages ? 
      req.body.languages.split(',').map(l => l.trim()) : 
      ['en', 'ar'];
    
    const results = [];
    
    for (const file of req.files) {
      let tempPath = null;
      try {
        tempPath = path.join(os.tmpdir(), `ocr_${Date.now()}_${file.originalname}`);
        await fs.writeFile(tempPath, file.buffer);
        
        const ocrResult = await performOCR(tempPath, languages);
        
        const extractedText = {};
        for (const [lang, langResults] of Object.entries(ocrResult.results)) {
          extractedText[lang] = langResults.map(r => r.text).join(' ');
        }
        
        results.push({
          filename: file.originalname,
          success: true,
          text: extractedText,
          details: ocrResult
        });
        
        await fs.unlink(tempPath);
      } catch (error) {
        results.push({
          filename: file.originalname,
          success: false,
          error: error.message
        });
        if (tempPath) {
          try {
            await fs.unlink(tempPath);
          } catch (e) {}
        }
      }
    }
    
    res.json({
      success: true,
      total: req.files.length,
      processed: results.filter(r => r.success).length,
      results: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Batch OCR Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Batch OCR processing failed'
    });
  }
});

// Language detection endpoint
app.post('/detect-language', upload.single('document'), async (req, res) => {
  let tempPath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    tempPath = path.join(os.tmpdir(), `detect_${Date.now()}_${req.file.originalname}`);
    await fs.writeFile(tempPath, req.file.buffer);
    
    // Mock language detection
    // In production, this would use PaddleOCR's language detection
    const detectedLanguages = [
      { language: 'en', confidence: 0.85, script: 'Latin' },
      { language: 'ar', confidence: 0.12, script: 'Arabic' },
      { language: 'es', confidence: 0.03, script: 'Latin' }
    ];
    
    res.json({
      success: true,
      filename: req.file.originalname,
      detected_languages: detectedLanguages,
      primary_language: detectedLanguages[0],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Language Detection Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Language detection failed'
    });
  } finally {
    if (tempPath) {
      try {
        await fs.unlink(tempPath);
      } catch (e) {}
    }
  }
});

// Document structure analysis endpoint
app.post('/analyze-structure', upload.single('document'), async (req, res) => {
  let tempPath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    tempPath = path.join(os.tmpdir(), `analyze_${Date.now()}_${req.file.originalname}`);
    await fs.writeFile(tempPath, req.file.buffer);
    
    // Mock document structure analysis
    const structure = {
      document_type: 'USCIS Form',
      form_number: 'I-485',
      sections: [
        { type: 'header', text: 'UNITED STATES CITIZENSHIP AND IMMIGRATION SERVICES', confidence: 0.98 },
        { type: 'title', text: 'Application to Register Permanent Residence', confidence: 0.97 },
        { type: 'field', label: 'Family Name', value: '', confidence: 0.95 },
        { type: 'field', label: 'Given Name', value: '', confidence: 0.94 },
        { type: 'field', label: 'A-Number', value: '', confidence: 0.93 },
        { type: 'checkbox', label: 'New Filing', checked: false, confidence: 0.90 }
      ],
      layout: {
        columns: 2,
        has_tables: true,
        has_checkboxes: true,
        has_signatures: false
      },
      quality_score: 0.92
    };
    
    res.json({
      success: true,
      filename: req.file.originalname,
      structure: structure,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Structure Analysis Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Structure analysis failed'
    });
  } finally {
    if (tempPath) {
      try {
        await fs.unlink(tempPath);
      } catch (e) {}
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`PaddleOCR Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('\nAvailable endpoints:');
  console.log('  POST /ocr - Single document OCR');
  console.log('  POST /ocr/batch - Batch OCR processing');
  console.log('  POST /detect-language - Language detection');
  console.log('  POST /analyze-structure - Document structure analysis');
});