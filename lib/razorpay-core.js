// Shared Razorpay logic used by both Vercel (api/) and Netlify (netlify/functions/) serverless functions.
import crypto from 'node:crypto';

export const DEFAULT_COUPONS = [
  { code: 'AREEX10', discountPercent: 10 },
  { code: 'INDIA20', discountPercent: 20 },
  { code: 'CHAMPION30', discountPercent: 30 },
];

const env = (k) => (process.env[k] || '').trim();

export function getKeys() {
  const keyId = env('RAZORPAY_KEY_ID') || env('VITE_RAZORPAY_KEY_ID');
  const keySecret = env('RAZORPAY_KEY_SECRET');
  const validKeyId = /^rzp_(live|test)_/.test(keyId) && keyId !== 'rzp_live_or_test_key_id';
  const validSecret = Boolean(keySecret) && keySecret !== 'your_razorpay_key_secret';
  return { keyId, keySecret, validKeyId, validSecret };
}

function discountFor(promoCode) {
  const code = String(promoCode || '').trim().toUpperCase();
  const hit = DEFAULT_COUPONS.find((c) => c.code === code);
  return hit ? hit.discountPercent : 0;
}

export function config() {
  const { keyId, validKeyId, validSecret } = getKeys();
  return {
    status: 200,
    json: {
      configured: validKeyId,
      hasOrderSecret: validKeyId && validSecret,
      keyId: validKeyId ? keyId : null,
      mode: keyId.startsWith('rzp_live_') ? 'live' : keyId.startsWith('rzp_test_') ? 'test' : 'interactive',
    },
  };
}

export async function createOrder(body = {}) {
  const { keyId, keySecret, validKeyId, validSecret } = getKeys();
  if (!validKeyId || !validSecret) {
    return { status: 400, json: { error: 'Razorpay keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured.' } };
  }
  const baseAmount = Number(body.priceInr) || 499;
  const finalAmountInr = Math.max(1, Math.round(baseAmount * (1 - discountFor(body.promoCode) / 100)));

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: finalAmountInr * 100,
      currency: 'INR',
      receipt: `arx_${Date.now()}`,
      notes: {
        planId: String(body.planId || 'plan'),
        serverHostname: String(body.serverHostname || 'play.areexcloud.site'),
      },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.id) {
    return { status: 400, json: { error: data?.error?.description || 'Failed to create Razorpay order.' } };
  }
  return {
    status: 200,
    json: { orderId: data.id, amountPaise: data.amount, finalAmountInr, currency: 'INR', keyId },
  };
}

export function verifyPayment(body = {}) {
  const { keySecret, validSecret } = getKeys();
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!validSecret || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return { status: 400, json: { error: 'Missing Razorpay payment verification parameters.' } };
  }
  const expected = crypto.createHmac('sha256', keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(razorpay_signature));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { status: 400, json: { error: 'Razorpay payment signature verification failed.' } };
  }

  const baseAmount = Number(body.priceInr) || 499;
  const discountPercent = discountFor(body.promoCode);
  const finalAmountInr = Math.max(1, Math.round(baseAmount * (1 - discountPercent / 100)));
  const node = body.datacenterNode;
  const subnet = node === 'Mumbai IN-West-1' ? '103.195.102' : node === 'Noida IN-North-1' ? '103.148.204' : '139.99.68';
  const hostOctet = crypto.randomInt(12, 250);
  const port = crypto.randomInt(25565, 25699);
  const host = String(body.serverHostname || 'server').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toLowerCase();

  const credentials = {
    transactionId: String(razorpay_payment_id),
    serverUsername: `areex_${host}_${hostOctet}`,
    serverPassword: `Arx#${crypto.randomBytes(9).toString('base64url')}!9`,
    dedicatedEndpoint: `${subnet}.${hostOctet}:${port}`,
    sftpAddress: `sftp://${subnet}.${hostOctet}:2022`,
    rconToken: crypto.randomBytes(12).toString('hex'),
    datacenterNode: node || 'Mumbai IN-West-1',
    customerEmail: body.customerEmail || 'gamer@areexcloud.site',
    provisionedAt: new Date().toISOString(),
  };

  // AES-256-GCM vault (same format as server.ts)
  const secret = process.env.AES_MASTER_KEY || 'areex-cloud-sovereign-vault-256bit-key-2026-india';
  const key = crypto.scryptSync(secret, 'areex-cloud-kdf-salt-v1', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
  const combinedHex = Buffer.concat([enc, cipher.getAuthTag()]).toString('hex');
  const ivHex = iv.toString('hex');
  const hmacSignature = crypto.createHmac('sha256', key).update(`${ivHex}:${combinedHex}`).digest('hex');

  return {
    status: 200,
    json: {
      success: true,
      transactionId: String(razorpay_payment_id),
      planId: String(body.planId || 'elite_plus'),
      planName: String(body.planName || 'Elite Plus'),
      category: String(body.category || 'premium'),
      baseAmountInr: baseAmount,
      discountPercent,
      finalAmountInr,
      paymentMethod: 'razorpay_upi',
      serverHostname: String(body.serverHostname || 'play.areexcloud.site'),
      datacenterNode: String(node || 'Mumbai IN-West-1'),
      encryptedCredentials: combinedHex,
      encryptionIv: ivHex,
      hmacSignature,
      credentials,
    },
  };
}
