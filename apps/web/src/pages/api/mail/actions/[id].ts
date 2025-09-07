import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const MAIL_SERVICE_URL = process.env.MAIL_SERVICE_URL || 'http://localhost:3005';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Invalid action ID' });
  }

  try {
    if (req.method === 'POST') {
      // Execute action hook
      const response = await axios.post(`${MAIL_SERVICE_URL}/api/actions/execute`, {
        hookId: id,
        payload: req.body.payload || {},
        userId: req.body.userId
      }, {
        timeout: 30000, // 30 second timeout for action execution
      });
      
      return res.status(200).json(response.data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Action execution proxy error:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Mail service unavailable',
        message: 'The mail processing service is currently unavailable.'
      });
    }

    res.status(500).json({
      error: 'Action execution failed',
      message: error.response?.data?.message || 'An error occurred while executing the action'
    });
  }
}