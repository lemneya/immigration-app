import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const MAIL_SERVICE_URL = process.env.MAIL_SERVICE_URL || 'http://localhost:3005';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Invalid job ID' });
  }

  try {
    if (req.method === 'GET') {
      // Get mail job details
      const response = await axios.get(`${MAIL_SERVICE_URL}/api/mail/${id}`, {
        timeout: 10000,
      });
      return res.status(200).json(response.data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Mail job proxy error:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Mail service unavailable',
        message: 'The mail processing service is currently unavailable.'
      });
    }

    if (error.response?.status === 404) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'No mail job found with the provided ID'
      });
    }

    res.status(500).json({
      error: 'Request failed',
      message: error.response?.data?.message || 'An error occurred while retrieving job details'
    });
  }
}