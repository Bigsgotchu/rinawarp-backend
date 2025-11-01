import express from 'express';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

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
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ Webhook verified:', event.type);

  // Handle the event
  try {
    switch (event.type) {
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
 * Generate license key (JWT)
 */
function generateLicenseKey(email, tier) {
  const payload = {
    email,
    tier,
    product: 'rinawarp-terminal-pro',
    version: '1.0.0',
    issuedAt: new Date().toISOString(),
    expiresAt: tier.includes('lifetime') ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const secret = process.env.LICENSE_SECRET;
  const licenseKey = jwt.sign(payload, secret, { algorithm: 'HS256' });

  return licenseKey;
}

/**
 * Store license in database
 * TODO: Implement your database logic
 */
async function storeLicense(licenseData) {
  // Example: Save to database
  console.log('💾 Storing license:', licenseData);
  
  // Implement your database storage here
  // Example with MongoDB:
  // await License.create(licenseData);
  
  // Example with PostgreSQL:
  // await db.query('INSERT INTO licenses ...', [licenseData]);
}

/**
 * Update license status
 */
async function updateLicenseStatus(subscriptionId, status) {
  console.log(`🔄 Updating license status for subscription ${subscriptionId} to ${status}`);
  
  // Implement your database update here
  // await License.updateOne({ subscriptionId }, { status });
}

/**
 * Send license email to customer
 * TODO: Implement email sending
 */
async function sendLicenseEmail(email, licenseKey, tier) {
  console.log('📧 Sending license email to:', email);

  // Implement email sending here
  // Example with Nodemailer:
  /*
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: 'support@rinawarptech.com',
    to: email,
    subject: 'Your RinaWarp Terminal Pro License',
    html: `
      <h1>Welcome to RinaWarp Terminal Pro!</h1>
      <p>Thank you for your purchase. Here is your license key:</p>
      <pre>${licenseKey}</pre>
      <p>Tier: ${tier}</p>
      <p>Download: https://rinawarptech.com/downloads</p>
    `,
  });
  */
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
