// AI Credits Checkout Routes - ES6 Module
import express from 'express';

// For demo purposes, we'll mock the Stripe session creation
// In production, uncomment and configure Stripe:
// const Stripe = require('stripe');
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
//   apiVersion: '2025-07-30.basil',
// });

const router = express.Router();

/**
 * Helper function to resolve user identity from request
 * Supports both web users and desktop users with license keys
 */
function resolveIdentityFromReq(req) {
  // Check for license key in headers (desktop users)
  const licenseKey = req.headers['x-rinawarp-license'];
  if (licenseKey) {
    return { licenseKey };
  }

  // Check for user session (web users)
  const userId = req.user?.id || req.session?.userId;
  if (userId) {
    return { userId };
  }

  return {};
}

// POST /api/ai-credits/checkout/create
router.post('/create', async (req, res) => {
  try {
    const { bundleId } = req.body;

    if (!bundleId) {
      return res.status(400).json({ ok: false, error: 'Missing bundleId' });
    }

    // Get public URL for redirects
    const publicUrl = process.env.PUBLIC_URL || 'http://localhost:3000';

    // For demo purposes, create mock checkout session
    // In production, you would fetch bundle from database
    const mockBundles = {
      1: { id: 1, stripePriceId: 'price_starter_credits', name: 'Starter Pack', credits: 100, amountCents: 999 },
      2: { id: 2, stripePriceId: 'price_professional_credits', name: 'Professional Pack', credits: 500, amountCents: 3999 },
      3: { id: 3, stripePriceId: 'price_enterprise_credits', name: 'Enterprise Pack', credits: 1000, amountCents: 6999 }
    };

    const bundle = mockBundles[bundleId];
    if (!bundle) {
      return res.status(404).json({ ok: false, error: 'Bundle not found' });
    }

    // Attach identity so webhook knows who to credit
    const { userId, licenseKey } = resolveIdentityFromReq(req);

    // Mock checkout session for demo
    // In production, use actual Stripe:
    // const session = await stripe.checkout.sessions.create({ ... });
    const session = {
      url: `${publicUrl}/checkout-demo?bundle=${bundle.id}&credits=${bundle.credits}&amount=${bundle.amountCents}`
    };

    res.json({
      ok: true,
      url: session.url,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to create checkout session',
    });
  }
});

// GET /api/ai-credits/checkout/bundles
router.get('/bundles', async (req, res) => {
  try {
    // Mock bundles for demo
    const bundles = [
      { id: 1, name: 'Starter Pack', credits: 100, amountCents: 999, active: true },
      { id: 2, name: 'Professional Pack', credits: 500, amountCents: 3999, active: true },
      { id: 3, name: 'Enterprise Pack', credits: 1000, amountCents: 6999, active: true },
    ];

    res.json({
      ok: true,
      bundles,
    });
  } catch (err) {
    console.error('Bundles fetch error:', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch bundles',
    });
  }
});

export default router;