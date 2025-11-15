// backend/routes/stripe-production.js
import express from 'express';
import Stripe from 'stripe';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const router = express.Router();

// Lazy-load Stripe to avoid initialization errors during module loading
let stripe = null;
const getStripe = () => {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
};

// Helper function to get private key for license signing
const getPrivateKey = () => {
  const keyPath = process.env.LICENSE_SIGNING_PRIVATE_KEY_PATH;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error('License signing private key not found');
  }
  return fs.readFileSync(keyPath, 'utf8');
};

// POST /api/stripe/webhook - Handle Stripe webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    logger.error('STRIPE', `Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info('STRIPE', `🔔 Webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('STRIPE', `Webhook handler error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stripe/checkout - Create checkout session
router.post('/checkout', async (req, res) => {
  try {
    const { mode = 'payment', priceId, email } = req.body;

    if (!priceId || !email) {
      return res.status(400).json({
        ok: false,
        error: 'Price ID and email are required'
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: mode,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL,
      cancel_url: process.env.STRIPE_CANCEL_URL,
      customer_email: email,
      automatic_tax: { enabled: true },
      metadata: {
        rinawarp_type: mode === 'subscription' ? 'subscription' : 'lifetime',
        rinawarp_price_id: priceId,
      },
    });

    res.json({
      ok: true,
      url: session.url
    });
  } catch (error) {
    logger.error('STRIPE', `Checkout error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Webhook event handlers
async function handleCheckoutCompleted(session) {
  logger.success('STRIPE', `✅ Checkout completed: ${session.id}`);

  const customerEmail = session.customer_email;
  const metadata = session.metadata;

  try {
    // Generate license based on payment
    const license = await issueLicenseAfterPayment(session);

    // TODO: Send license via email
    logger.info('STRIPE', `📧 License issued for: ${customerEmail}`);

    // Log the sale
    await logSale(session);
  } catch (error) {
    logger.error('STRIPE', `Error handling checkout completion: ${error.message}`);
  }
}

async function handleSubscriptionCreated(subscription) {
  logger.info('STRIPE', `📅 Subscription created: ${subscription.id}`);
  // Handle subscription creation
}

async function handleSubscriptionUpdated(subscription) {
  logger.info('STRIPE', `🔄 Subscription updated: ${subscription.id}`);
  // Handle subscription updates
}

async function handleSubscriptionDeleted(subscription) {
  logger.warn('STRIPE', `❌ Subscription deleted: ${subscription.id}`);
  // Handle subscription cancellation
}

async function handlePaymentSucceeded(invoice) {
  logger.success('STRIPE', `💰 Payment succeeded: ${invoice.id}`);
  // Handle successful payments
}

async function handlePaymentFailed(invoice) {
  logger.error('STRIPE', `💸 Payment failed: ${invoice.id}`);
  // Handle failed payments
}

// Issue license after successful payment
async function issueLicenseAfterPayment(session) {
  const payload = {
    sub: session.customer_email,
    iss: process.env.LICENSE_ISSUER || 'RinaWarp',
    typ: 'license',
    tier: session.mode === 'subscription' ? 'subscription' : 'lifetime',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
  };

  const token = jwt.sign(payload, getPrivateKey(), { algorithm: 'RS256' });

  return token;
}

// Log sales for analytics
async function logSale(session) {
  const saleData = {
    sessionId: session.id,
    customerEmail: session.customer_email,
    amount: session.amount_total,
    currency: session.currency,
    metadata: session.metadata,
    timestamp: new Date().toISOString(),
  };

  // Log to console for now (in production, save to database)
  logger.info('STRIPE', `💰 Sale logged: ${JSON.stringify(saleData)}`);
}

export default router;
