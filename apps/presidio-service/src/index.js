const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3024;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// PII patterns for immigration documents
const PII_PATTERNS = {
  SSN: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/g,
    type: 'SSN',
    replacement: '[SSN-REDACTED]'
  },
  A_NUMBER: {
    pattern: /\b[Aa][-\s]?\d{8,9}\b/g,
    type: 'A-Number',
    replacement: '[A-NUMBER-REDACTED]'
  },
  RECEIPT_NUMBER: {
    pattern: /\b[A-Z]{3}\d{10}\b/g,
    type: 'Receipt Number',
    replacement: '[RECEIPT-REDACTED]'
  },
  PASSPORT: {
    pattern: /\b[A-Z][0-9]{8}\b/g,
    type: 'Passport',
    replacement: '[PASSPORT-REDACTED]'
  },
  DATE_OF_BIRTH: {
    pattern: /\b(0[1-9]|1[0-2])[\/-](0[1-9]|[12][0-9]|3[01])[\/-](19|20)\d{2}\b/g,
    type: 'Date of Birth',
    replacement: '[DOB-REDACTED]'
  },
  PHONE: {
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    type: 'Phone Number',
    replacement: '[PHONE-REDACTED]'
  },
  EMAIL: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    type: 'Email',
    replacement: '[EMAIL-REDACTED]'
  },
  CREDIT_CARD: {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    type: 'Credit Card',
    replacement: '[CC-REDACTED]'
  },
  ADDRESS: {
    pattern: /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Plaza|Pl)\.?\s*(?:(?:Apt|Apartment|Suite|Ste|Unit|#)\s*[\w\d]+)?/gi,
    type: 'Address',
    replacement: '[ADDRESS-REDACTED]'
  }
};

// Immigration-specific entities
const IMMIGRATION_ENTITIES = {
  CASE_NUMBER: /\b(?:MSC|EAC|WAC|NSC|SRC|LIN|YSC|TSC)\d{10}\b/g,
  VISA_NUMBER: /\b[A-Z]{2}\d{7}\b/g,
  I94_NUMBER: /\b\d{11}\b/g,
  COURT_HEARING: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi
};

// Detect PII in text
function detectPII(text) {
  const findings = [];
  
  // Check standard PII patterns
  for (const [key, config] of Object.entries(PII_PATTERNS)) {
    const matches = text.match(config.pattern);
    if (matches) {
      matches.forEach(match => {
        const index = text.indexOf(match);
        findings.push({
          entity_type: config.type,
          text: match,
          start: index,
          end: index + match.length,
          confidence: 0.95
        });
      });
    }
  }
  
  // Check immigration-specific patterns
  for (const [key, pattern] of Object.entries(IMMIGRATION_ENTITIES)) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const index = text.indexOf(match);
        findings.push({
          entity_type: key.replace(/_/g, ' ').toLowerCase(),
          text: match,
          start: index,
          end: index + match.length,
          confidence: 0.90
        });
      });
    }
  }
  
  return findings.sort((a, b) => a.start - b.start);
}

// Mask PII in text
function maskPII(text, maskingConfig = {}) {
  let maskedText = text;
  const maskLog = [];
  
  // Apply standard PII masking
  for (const [key, config] of Object.entries(PII_PATTERNS)) {
    if (maskingConfig[config.type] !== false) {
      const matches = maskedText.match(config.pattern);
      if (matches) {
        matches.forEach(match => {
          const replacement = maskingConfig[config.type] || config.replacement;
          maskedText = maskedText.replace(match, replacement);
          maskLog.push({
            type: config.type,
            original_length: match.length,
            masked: replacement
          });
        });
      }
    }
  }
  
  return { maskedText, maskLog };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Presidio PII Service',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Analyze text for PII
app.post('/analyze', (req, res) => {
  try {
    const { text, language = 'en', entities = [] } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const findings = detectPII(text);
    
    // Filter by requested entities if specified
    const filteredFindings = entities.length > 0
      ? findings.filter(f => entities.includes(f.entity_type))
      : findings;
    
    res.json({
      success: true,
      text_length: text.length,
      language,
      findings: filteredFindings,
      summary: {
        total_findings: filteredFindings.length,
        entity_types: [...new Set(filteredFindings.map(f => f.entity_type))],
        high_risk_count: filteredFindings.filter(f => 
          ['SSN', 'A-Number', 'Credit Card'].includes(f.entity_type)
        ).length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Analysis Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Analysis failed'
    });
  }
});

// Anonymize text
app.post('/anonymize', (req, res) => {
  try {
    const { 
      text, 
      masking_config = {},
      return_mappings = false 
    } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const { maskedText, maskLog } = maskPII(text, masking_config);
    
    const response = {
      success: true,
      original_length: text.length,
      anonymized_text: maskedText,
      items_masked: maskLog.length,
      timestamp: new Date().toISOString()
    };
    
    if (return_mappings) {
      response.mask_log = maskLog;
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('Anonymization Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Anonymization failed'
    });
  }
});

// Batch processing endpoint
app.post('/batch', (req, res) => {
  try {
    const { documents } = req.body;
    
    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({ error: 'Documents array is required' });
    }
    
    const results = documents.map((doc, index) => {
      try {
        const findings = detectPII(doc.text || '');
        const { maskedText } = maskPII(doc.text || '');
        
        return {
          document_id: doc.id || `doc_${index}`,
          success: true,
          findings_count: findings.length,
          anonymized_text: maskedText,
          high_risk: findings.some(f => 
            ['SSN', 'A-Number', 'Credit Card'].includes(f.entity_type)
          )
        };
      } catch (error) {
        return {
          document_id: doc.id || `doc_${index}`,
          success: false,
          error: error.message
        };
      }
    });
    
    res.json({
      success: true,
      total_documents: documents.length,
      processed: results.filter(r => r.success).length,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Batch Processing Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Batch processing failed'
    });
  }
});

// Validate document for PII compliance
app.post('/validate', (req, res) => {
  try {
    const { text, document_type = 'general' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const findings = detectPII(text);
    
    // Immigration document validation rules
    const validationRules = {
      public_form: {
        forbidden: ['SSN', 'Credit Card'],
        required: []
      },
      internal_document: {
        forbidden: ['Credit Card'],
        required: ['A-Number']
      },
      court_filing: {
        forbidden: ['SSN', 'Credit Card'],
        required: ['A-Number', 'case_number']
      }
    };
    
    const rules = validationRules[document_type] || validationRules.general;
    const foundTypes = findings.map(f => f.entity_type);
    
    const violations = [];
    
    // Check forbidden entities
    if (rules.forbidden) {
      rules.forbidden.forEach(type => {
        if (foundTypes.includes(type)) {
          violations.push({
            type: 'forbidden',
            entity: type,
            message: `${type} should not be included in ${document_type}`
          });
        }
      });
    }
    
    // Check required entities
    if (rules.required) {
      rules.required.forEach(type => {
        if (!foundTypes.includes(type)) {
          violations.push({
            type: 'missing',
            entity: type,
            message: `${type} is required for ${document_type}`
          });
        }
      });
    }
    
    res.json({
      success: true,
      document_type,
      is_valid: violations.length === 0,
      violations,
      pii_found: foundTypes,
      risk_level: findings.some(f => 
        ['SSN', 'Credit Card'].includes(f.entity_type)
      ) ? 'high' : 'medium',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Validation Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Validation failed'
    });
  }
});

// Entity configuration endpoint
app.get('/entities', (req, res) => {
  const entities = [
    ...Object.values(PII_PATTERNS).map(p => ({
      name: p.type,
      category: 'PII',
      risk_level: ['SSN', 'Credit Card'].includes(p.type) ? 'high' : 'medium'
    })),
    ...Object.keys(IMMIGRATION_ENTITIES).map(key => ({
      name: key.replace(/_/g, ' ').toLowerCase(),
      category: 'Immigration',
      risk_level: 'low'
    }))
  ];
  
  res.json({
    success: true,
    entities,
    total: entities.length,
    categories: ['PII', 'Immigration']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Presidio PII Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('\nAvailable endpoints:');
  console.log('  POST /analyze - Detect PII in text');
  console.log('  POST /anonymize - Mask PII in text');
  console.log('  POST /batch - Process multiple documents');
  console.log('  POST /validate - Validate document compliance');
  console.log('  GET /entities - List supported entity types');
});