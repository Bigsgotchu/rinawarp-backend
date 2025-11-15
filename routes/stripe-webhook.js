import express from 'express';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const router = express.Router();

// Lazy-load Stripe to avoid initialization errors during module loading
let stripe = null;
const getStripe = () => {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }
  return stripe;
};

// Price ID to Plan mapping - UPDATE WITH YOUR ACTUAL STRIPE PRICE IDs
const PRICE_TO_PLAN_MAP = {
  // Monthly plans
  'price_starter_monthly_id': 'Starter',
  'price_creator_monthly_id': 'Creator',
  'price_pro_monthly_id': 'Pro',
  // Lifetime plans
  'price_pioneer_lifetime_id': 'Pioneer',
  'price_founder_lifetime_id': 'Founder',
  // Enterprise
  'price_enterprise_id': 'Enterprise',
};

// Generate unique license key
function generateLicenseKey() {
  const segments = [];
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars
  const segmentLen = 4;

  for (let i = 0; i < 3; i++) {
    let s = "";
    for (let j = 0; j < segmentLen; j++) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    segments.push(s);
  }

  const prefix = "RWP";
  return `${prefix}-${segments.join("-")}`;
}

// Simple in-memory license storage (replace with database in production)
const licenses = new Map();

// Send license email
async function sendLicenseEmail(to, licenseKey, plan, downloadUrl) {
  const subject = `Your RinaWarp Terminal Pro License (${plan})`;

  const html = `
    <p>Hey there,</p>
    <p>Thank you for purchasing <strong>RinaWarp Terminal Pro</strong> (${plan}).</p>
    <p>Your license key:</p>
    <pre style="font-size:16px;font-family:monospace;padding:12px;border-radius:8px;background:#050816;color:#4ade80;">
${licenseKey}
    </pre>
    <p>Next steps:</p>
    <ol>
      <li>Download RinaWarp Terminal Pro from: <a href="${downloadUrl}">${downloadUrl}</a></li>
      <li>Install and launch the app.</li>
      <li>On first start, enter your email and this license key to activate.</li>
    </ol>
    <p>If you have any trouble activating, reply to this email or visit Support.</p>
    <p>— RinaWarp Team</p>
  `;

  // For now, just log it. In production, you'd use nodemailer or your email service
  console.log(`📧 EMAIL TO: ${to}`);
  console.log(`📧 SUBJECT: ${subject}`);
  console.log(`📧 CONTENT: ${html}`);
  
  // TODO: Implement actual email sending with nodemailer or your email service
}

// Store license (replace with database in production)
function storeLicense(licenseKey, plan, email, metadata = {}) {
  licenses.set(licenseKey, {
    key: licenseKey,
    plan,
    email: email || null,
    status: 'active',
    maxActivations: plan === 'Founder' || plan === 'Pioneer' ? 10 : 3,
    activations: 0,
    createdAt: new Date().toISOString(),
    metadata,
  });
  console.log(`💾 Stored license: ${licenseKey} (${plan})`);
}

// Get license by key
function getLicense(licenseKey) {
  return licenses.get(licenseKey);
}

// Update license activations
function activateLicense(licenseKey, email) {
  const license = licenses.get(licenseKey);
  if (!license) {
    throw new Error('License not found');
  }
  
  if (license.status !== 'active') {
    throw new Error('License is not active');
  }
  
  if (license.activations >= license.maxActivations) {
    throw new Error('License has reached its activation limit');
  }
  
  license.activations += 1;
  if (email && !license.email) {
    license.email = email;
  }
  license.activatedAt = new Date().toISOString();
  
  licenses.set(licenseKey, license);
  return license;
}

/**
 * Handle checkout session completed - NEW MAIN HANDLER
 * This is called when a customer successfully completes payment
 */
async function handleCheckoutSessionCompleted(session) {
  console.log('🎉 Checkout session completed:', session.id);

  // Only handle if it's for Terminal Pro / licenses
  const mode = session.mode;
  if (mode !== 'payment' && mode !== 'subscription') {
    console.log('Skipping session - not a payment or subscription');
    return;
  }

  // Extract email & line items
  const email = (session.customer_details?.email || session.customer_email) || null;
  console.log('Customer email:', email);

  try {
    // Get line items to find price IDs
    const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 10 });
    console.log('Line items:', lineItems.data.length);

    for (const item of lineItems.data) {
      const priceId = (item.price?.id || '');
      console.log('Processing price ID:', priceId);
      
      const plan = PRICE_TO_PLAN_MAP[priceId];
      if (!plan) {
        console.log(`Unknown price ID: ${priceId}, skipping`);
        continue;
      }

      console.log(`Creating license for plan: ${plan}`);

      // Generate unique license key
      let licenseKey;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        licenseKey = generateLicenseKey();
        if (!licenses.has(licenseKey)) break; // Check if key exists
      }

      // Store license in database
      storeLicense(licenseKey, plan, email, {
        stripePriceId: priceId,
        stripeCustomerId: session.customer || null,
        stripeSubscriptionId: session.subscription || null,
        source: 'stripe_webhook',
        createdBy: 'stripe_webhook'
      });

      console.log(`✅ Created license ${licenseKey} for ${email || 'unknown'} (${plan})`);

      // Send email if we have an email address
      if (email) {
        const downloadUrl = process.env.PUBLIC_DOWNLOAD_URL || 'https://rinawarptech.com/downloads.html#terminal-pro';
        
        await sendLicenseEmail(email, licenseKey, plan, downloadUrl);
        console.log(`📧 License email prepared for ${email}`);
      }
    }

  } catch (error) {
    console.error('Failed to process checkout session:', error);
  }
}

/**
 * Stripe Webhook Handler
 * Processes payment events and issues licenses
 *
 * IMPORTANT: This route must use raw body parsing
 * Configure in your main server file:
 *
 * app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
 * app.use('/api/stripe/webhook', webhookRouter);
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ Webhook verified:', event.type);

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;

      case 'charge.succeeded':
        await handleChargeSuccess(event.data.object);
        break;

      case 'charge.failed':
        await handleChargeFailure(event.data.object);
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

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(paymentIntent) {
  console.log('💰 Payment succeeded:', paymentIntent.id);

  const customerEmail = paymentIntent.receipt_email || paymentIntent.metadata?.email;
  const tier = paymentIntent.metadata?.tier || 'pro';
  const amount = paymentIntent.amount / 100; // Convert from cents

  // Generate license key
  const licenseKey = generateLicenseKey(customerEmail, tier);

  // Store license in database (implement your DB logic)
  await storeLicense({
    email: customerEmail,
    licenseKey,
    tier,
    amount,
    paymentIntentId: paymentIntent.id,
    status: 'active',
    createdAt: new Date(),
  });

  // Send license email to customer
  await sendLicenseEmail(customerEmail, licenseKey, tier);

  console.log('✅ License issued to:', customerEmail);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(paymentIntent) {
  console.log('❌ Payment failed:', paymentIntent.id);

  const customerEmail = paymentIntent.receipt_email || paymentIntent.metadata?.email;
  const reason = paymentIntent.last_payment_error?.message || 'Unknown error';

  // Send failure notification
  await sendPaymentFailureEmail(customerEmail, reason);

  console.log('📧 Failure notification sent to:', customerEmail);
}

/**
 * Handle successful charge
 */
async function handleChargeSuccess(charge) {
  console.log('💳 Charge succeeded:', charge.id);
  // Additional charge processing if needed
}

/**
 * Handle failed charge
 */
async function handleChargeFailure(charge) {
  console.log('❌ Charge failed:', charge.id);
  // Handle charge failure
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(subscription) {
  console.log('📅 Subscription created:', subscription.id);

  const customerEmail = subscription.metadata?.email;
  const tier = subscription.metadata?.tier || 'pro-monthly';

  // Generate license for subscription
  const licenseKey = generateLicenseKey(customerEmail, tier);

  await storeLicense({
    email: customerEmail,
    licenseKey,
    tier,
    subscriptionId: subscription.id,
    status: 'active',
    createdAt: new Date(),
  });

  await sendLicenseEmail(customerEmail, licenseKey, tier);
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription) {
  console.log('🔄 Subscription updated:', subscription.id);

  // Update license status based on subscription status
  if (subscription.status === 'active') {
    await updateLicenseStatus(subscription.id, 'active');
  } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    await updateLicenseStatus(subscription.id, 'inactive');
  }
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription) {
  console.log('🗑️  Subscription deleted:', subscription.id);

  // Deactivate license
  await updateLicenseStatus(subscription.id, 'canceled');

  const customerEmail = subscription.metadata?.email;
  await sendSubscriptionCanceledEmail(customerEmail);
}

/**
 * Send payment failure email
 */
async function sendPaymentFailureEmail(email, reason) {
  console.log('📧 Sending payment failure email to:', email);
  
  // Implement email sending
}

/**
 * Send subscription canceled email
 */
async function sendSubscriptionCanceledEmail(email) {
  console.log('📧 Sending subscription canceled email to:', email);
  
  // Implement email sending
}

export default router;

// ============================================================================
// LICENSE ACTIVATION API ROUTES FOR DESKTOP APP
// ============================================================================

// POST /api/license/activate
router.post('/activate', async (req, res) => {
  try {
    const { email, licenseKey, deviceId } = req.body || {};

    if (!email || !licenseKey) {
      return res.status(400).json({
        ok: false,
        error: 'Email and license key are required.',
      });
    }

    const normalizedKey = licenseKey.trim().toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    const license = getLicense(normalizedKey);
    if (!license) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid license key.',
      });
    }

    if (license.status !== 'active') {
      return res.status(400).json({
        ok: false,
        error: 'This license is not active.',
      });
    }

    if (license.activations >= license.maxActivations) {
      return res.status(400).json({
        ok: false,
        error: 'This license has reached its activation limit. Contact support if you need more activations.',
      });
    }

    const updatedLicense = activateLicense(normalizedKey, normalizedEmail);

    // Generate JWT token
    const payload = {
      licenseId: normalizedKey,
      key: updatedLicense.key,
      plan: updatedLicense.plan,
      email: normalizedEmail,
    };

    const token = jwt.sign(payload, process.env.LICENSE_JWT_SECRET || 'dev-secret-change-terminal-pro', {
      expiresIn: '365d',
    });

    return res.json({
      ok: true,
      token,
      license: {
        plan: updatedLicense.plan,
        status: updatedLicense.status,
        activations: updatedLicense.activations,
        maxActivations: updatedLicense.maxActivations,
      },
    });
  } catch (err) {
    console.error('License activation error:', err);
    return res.status(400).json({
      ok: false,
      error: err.message || 'Unable to activate license.',
    });
  }
});

// POST /api/license/validate
router.post('/validate', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({
        ok: false,
        error: 'Token is required.',
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.LICENSE_JWT_SECRET || 'dev-secret-change-terminal-pro');
      const license = getLicense(decoded.key);

      if (!license || license.status !== 'active') {
        return res.json({
          ok: false,
          valid: false,
          reason: 'inactive_or_missing',
        });
      }

      return res.json({
        ok: true,
        valid: true,
        license: {
          plan: license.plan,
          status: license.status,
          activations: license.activations,
          maxActivations: license.maxActivations,
        },
      });
    } catch (jwtError) {
      return res.json({
        ok: false,
        valid: false,
        reason: 'invalid_token',
      });
    }
  } catch (error) {
    return res.status(500).json({
      ok: false,
      valid: false,
      error: 'Validation failed.',
    });
  }
});

// POST /api/license/resend
router.post('/resend', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({
        ok: false,
        error: 'Email is required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    // Find licenses for this email
    const userLicenses = Array.from(licenses.values()).filter(lic =>
      lic.email && lic.email.toLowerCase() === normalizedEmail
    );

    if (!userLicenses.length) {
      return res.status(400).json({
        ok: false,
        error: 'No licenses found for that email. Check your spelling or use the email used at checkout.',
      });
    }

    const downloadUrl = process.env.PUBLIC_DOWNLOAD_URL || 'https://rinawarptech.com/downloads.html#terminal-pro';

    const licenseList = userLicenses
      .map(lic =>
        `Plan: ${lic.plan} | Key: ${lic.key} | Status: ${lic.status} | Activations: ${lic.activations}/${lic.maxActivations}`
      )
      .join('<br/>');

    const html = `
      <p>Hey there,</p>
      <p>Here are your recent RinaWarp Terminal Pro licenses associated with <strong>${normalizedEmail}</strong>:</p>
      <p>${licenseList}</p>
      <p>You can download the app here:<br/>
      <a href="${downloadUrl}">${downloadUrl}</a></p>
      <p>On first launch, enter your email and one of these license keys to activate.</p>
      <p>— RinaWarp Team</p>
    `;

    console.log(`📧 RESEND EMAIL TO: ${normalizedEmail}`);
    console.log(`📧 CONTENT: ${html}`);

    return res.json({
      ok: true,
      sent: true,
      count: userLicenses.length,
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      sent: false,
      error: err.message || 'Could not resend license email.',
    });
  }
});

// Export functions for external use (for database integration later)
router.get('/debug/licenses', (req, res) => {
  const allLicenses = Array.from(licenses.entries()).map(([key, value]) => ({
    key,
    ...value
  }));
  res.json({
    total: licenses.size,
    licenses: allLicenses
  });
});

router.delete('/debug/licenses/:key', (req, res) => {
  const { key } = req.params;
  if (licenses.has(key)) {
    licenses.delete(key);
    res.json({ ok: true, message: `License ${key} deleted` });
  } else {
    res.status(404).json({ ok: false, error: 'License not found' });
  }
});
