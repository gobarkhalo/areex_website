import { verifyPayment } from '../../lib/razorpay-core.js';

export default async function handler(req, res) {
  try {
    const out = await verifyPayment(req.body);
    res.status(out.status).json(out.json);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Razorpay request failed' });
  }
}
