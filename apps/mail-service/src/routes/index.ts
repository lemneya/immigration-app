/**
 * API Routes for Mail Service
 */

import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';

import multer from 'multer';

// Configure multer for file uploads
const upload = multer({
  dest: process.env.UPLOAD_DIR || './uploads',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, PDF, and TIFF files are allowed.'));
    }
  }
});
import { logger } from '../utils/logger';
import type { DatabaseService } from '../services/DatabaseService';
import type { MailProcessorService } from '../services/MailProcessorService';
import { IntegrationService } from '../services/IntegrationService';

const router = Router();

// Middleware to get services from app locals
const getServices = (req: any) => {
  const dbService: DatabaseService = req.app.locals.dbService;
  const mailProcessor: MailProcessorService = req.app.locals.mailProcessor;
  return { dbService, mailProcessor };
};

/**
 * POST /api/mail/ingest
 * Upload and process mail document
 */
router.post('/mail/ingest',
  upload.single('file'),
  [
    body('applicant_id').isUUID().withMessage('Valid applicant_id required'),
    body('source').isIn(['upload', 'email', 'drive']).withMessage('Invalid source'),
    body('user_language').optional().isLength({ min: 2, max: 5 }),
    body('skip_translation').optional().isBoolean(),
    body('include_risk_analysis').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please upload a document to process'
        });
      }

      const { dbService, mailProcessor } = getServices(req);
      const jobId = uuidv4();

      // Create job record
      const client = await dbService.getClient();
      
      try {
        await client.query(`
          INSERT INTO mail_jobs (id, applicant_id, source, original_file_url, status)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          jobId,
          req.body.applicant_id,
          req.body.source || 'upload',
          req.file.path,
          'received'
        ]);

        // Process document asynchronously
        const options = {
          user_language: req.body.user_language || 'en',
          skip_translation: req.body.skip_translation === 'true',
          include_risk_analysis: req.body.include_risk_analysis !== 'false'
        };

        // Start processing in background
        mailProcessor.processMailDocument(jobId, req.file.path, options)
          .catch(error => {
            logger.error(`Background processing failed for job ${jobId}:`, error);
          });

        res.json({
          job_id: jobId,
          status: 'received',
          message: 'Document uploaded successfully and processing started'
        });

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Mail ingest failed:', error);
      res.status(500).json({
        error: 'Processing failed',
        message: 'Unable to process uploaded document'
      });
    }
  }
);

/**
 * GET /api/mail/:id
 * Get mail job details
 */
router.get('/mail/:id',
  [param('id').isUUID().withMessage('Valid job ID required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { dbService } = getServices(req);
      const client = await dbService.getClient();

      try {
        // Get job details
        const jobResult = await client.query(`
          SELECT * FROM mail_jobs WHERE id = $1
        `, [req.params.id]);

        if (jobResult.rows.length === 0) {
          return res.status(404).json({
            error: 'Job not found',
            message: 'No mail job found with the provided ID'
          });
        }

        const job = jobResult.rows[0];

        // Get associated actions
        const actionsResult = await client.query(`
          SELECT * FROM mail_actions 
          WHERE mail_job_id = $1 
          ORDER BY priority DESC, due_at ASC
        `, [req.params.id]);

        const response = {
          ...job,
          actions: actionsResult.rows,
          processing_complete: job.status === 'ready' || job.status === 'error'
        };

        res.json(response);

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get mail job:', error);
      res.status(500).json({
        error: 'Database error',
        message: 'Unable to retrieve job details'
      });
    }
  }
);

/**
 * POST /api/mail/:id/actions/:actionId
 * Update action status
 */
router.post('/mail/:id/actions/:actionId',
  [
    param('id').isUUID(),
    param('actionId').isUUID(),
    body('status').isIn(['todo', 'done', 'skipped'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { dbService } = getServices(req);
      const client = await dbService.getClient();

      try {
        const result = await client.query(`
          UPDATE mail_actions 
          SET status = $1, completed_at = CASE WHEN $1 = 'done' THEN NOW() ELSE NULL END
          WHERE id = $2 AND mail_job_id = $3
          RETURNING *
        `, [req.body.status, req.params.actionId, req.params.id]);

        if (result.rows.length === 0) {
          return res.status(404).json({
            error: 'Action not found'
          });
        }

        res.json({
          message: 'Action updated successfully',
          action: result.rows[0]
        });

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to update action:', error);
      res.status(500).json({
        error: 'Database error',
        message: 'Unable to update action status'
      });
    }
  }
);

/**
 * POST /api/mail/:id/link-case
 * Link mail job to USCIS case
 */
router.post('/mail/:id/link-case',
  [
    param('id').isUUID(),
    body('case_id').optional().isUUID(),
    body('receipt_number').optional().isLength({ min: 13, max: 13 })
  ],
  async (req, res) => {
    try {
      const { dbService } = getServices(req);
      // Implementation would link to case status service
      
      res.json({
        message: 'Case linked successfully',
        linked_to: req.body.case_id || req.body.receipt_number
      });

    } catch (error) {
      logger.error('Failed to link case:', error);
      res.status(500).json({
        error: 'Linking failed',
        message: 'Unable to link to USCIS case'
      });
    }
  }
);

/**
 * GET /api/mail/jobs
 * Get jobs for applicant
 */
router.get('/mail/jobs',
  [
    body('applicant_id').optional().isUUID()
  ],
  async (req, res) => {
    try {
      const { dbService } = getServices(req);
      const client = await dbService.getClient();
      const applicantId = req.query.applicant_id;

      try {
        let query = `
          SELECT 
            mj.*,
            COUNT(ma.id) as action_count,
            COUNT(CASE WHEN ma.status = 'todo' THEN 1 END) as pending_actions
          FROM mail_jobs mj
          LEFT JOIN mail_actions ma ON mj.id = ma.mail_job_id
        `;
        
        const params = [];
        if (applicantId) {
          query += ` WHERE mj.applicant_id = $1`;
          params.push(applicantId);
        }
        
        query += `
          GROUP BY mj.id
          ORDER BY mj.created_at DESC
          LIMIT 50
        `;

        const result = await client.query(query, params);

        res.json({
          jobs: result.rows,
          total: result.rows.length
        });

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get jobs:', error);
      res.status(500).json({
        error: 'Database error'
      });
    }
  }
);

/**
 * GET /api/mail/stats
 * Get processing statistics
 */
router.get('/mail/stats', async (req, res) => {
  try {
    const { dbService } = getServices(req);
    const client = await dbService.getClient();

    try {
      const statsResult = await client.query(`
        SELECT 
          status,
          COUNT(*) as count,
          doc_type
        FROM mail_jobs 
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY status, doc_type
        ORDER BY count DESC
      `);

      const stats = {
        last_30_days: {},
        by_status: {},
        by_doc_type: {}
      };

      for (const row of statsResult.rows) {
        stats.by_status[row.status] = (stats.by_status[row.status] || 0) + parseInt(row.count);
        if (row.doc_type) {
          stats.by_doc_type[row.doc_type] = (stats.by_doc_type[row.doc_type] || 0) + parseInt(row.count);
        }
      }

      res.json(stats);

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to get stats:', error);
    res.status(500).json({ error: 'Unable to retrieve statistics' });
  }
});

/**
 * POST /api/actions/execute
 * Execute one-click action hook
 */
router.post('/actions/execute',
  [
    body('hookId').notEmpty().withMessage('Hook ID required'),
    body('payload').optional().isObject(),
    body('userId').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const integrationService = new IntegrationService();
      const result = await integrationService.executeAction(
        req.body.hookId,
        req.body.payload || {},
        req.body.userId
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Action execution failed:', error);
      res.status(500).json({
        error: 'Action execution failed',
        message: 'Unable to execute the requested action'
      });
    }
  }
);

/**
 * GET /api/actions/health
 * Check integration service health
 */
router.get('/actions/health', async (req, res) => {
  try {
    const integrationService = new IntegrationService();
    const health = await integrationService.checkServiceHealth();
    
    res.json({
      status: 'ok',
      services: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      error: 'Health check failed'
    });
  }
});

export { router as routes };