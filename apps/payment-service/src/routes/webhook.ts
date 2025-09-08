import { Router } from 'express';

const router = Router();

// Stripe webhook endpoint
router.post('/stripe', async (req, res) => {
  res.json({ message: 'Stripe webhook endpoint - to be implemented' });
});

// PayPal webhook endpoint
router.post('/paypal', async (req, res) => {
  res.json({ message: 'PayPal webhook endpoint - to be implemented' });
});

export default router;