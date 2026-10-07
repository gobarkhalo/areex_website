# Deploying Areex Cloud

## GitHub Pages
1. Repo → Settings → Pages → Source: **GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables** → add `VITE_RAZORPAY_KEY_ID` (your `rzp_live_...` / `rzp_test_...` key id).
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes `dist/`.
(Pages cannot run a backend, so payments use Razorpay Checkout directly with the public key.)

## Vercel / Netlify
Set env vars `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (and optionally `VITE_RAZORPAY_KEY_ID`).
`api/razorpay/*` (Vercel) and `netlify/functions/razorpay.js` (Netlify) create orders and verify signatures.
