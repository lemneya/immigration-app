import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAIL_SERVICE_URL = process.env.MAIL_SERVICE_URL || 'http://localhost:3005';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Create FormData to forward to mail service
    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.filepath), file.originalFilename || 'upload');
    
    // Forward other fields
    Object.entries(fields).forEach(([key, value]) => {
      const fieldValue = Array.isArray(value) ? value[0] : value;
      if (fieldValue) {
        formData.append(key, fieldValue);
      }
    });

    // Forward to mail service
    const response = await axios.post(`${MAIL_SERVICE_URL}/api/mail/ingest`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 60000, // 60 second timeout
    });

    // Clean up uploaded file
    try {
      await fs.promises.unlink(file.filepath);
    } catch (error) {
      console.warn('Failed to clean up uploaded file:', error);
    }

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Mail ingest proxy error:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Mail service unavailable',
        message: 'The mail processing service is currently unavailable. Please try again later.'
      });
    }

    res.status(500).json({
      error: 'Processing failed',
      message: error.response?.data?.message || 'An error occurred while processing your document'
    });
  }
}