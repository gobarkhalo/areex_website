import { config, createOrder, verifyPayment } from '../../lib/razorpay-core.js';

const routes = { config, 'create-order': createOrder, 'verify-payment': verifyPayment };

export default async (req) => {
  const action = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  const fn = routes[action];
  if (!fn) return Response.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const out = await fn(body);
    return Response.json(out.json, { status: out.status });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Razorpay request failed' }, { status: 500 });
  }
};
