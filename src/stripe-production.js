// RinaWarp Terminal Pro - Production Stripe Integration
import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { generateLicense } from './license-system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
if (!process.env.STRIPE_SECRET_KEY) {
  const envPath = join(__dirname, '..', '..', '.env');
  dotenv.config({ path: envPath });
  console.log(`🌱 Loaded environment from ${envPath}`);
}

console.log('🚀 Stripe production module loaded');
console.log('🔑 Stripe env check:', {
  keyExists: !!process.env.STRIPE_SECRET_KEY,
  keyPrefix: process.env.STRIPE_SECRET_KEY
    ? process.env.STRIPE_SECRET_KEY.substring(0, 10) + '...'
    : 'NOT_SET',
});

// Initialize Stripe with production keys
console.log('🔑 Stripe initialization:', {
  keyExists: !!process.env.STRIPE_SECRET_KEY,
  keyPrefix: process.env.STRIPE_SECRET_KEY
    ? process.env.STRIPE_SECRET_KEY.substring(0, 10) + '...'
    : 'NOT_SET',
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Product and pricing configuration
const PRODUCTS = {
  creator: {
    name: 'RinaWarp Terminal Pro — Creator',
    description: 'Indie access with monthly and yearly subscriptions',
    monthlyPriceId: 'price_1SMHplGZrRdZy3W9g7MTRc7D',
    yearlyPriceId: 'price_1SMHplGZrRdZy3W9XklM6J6y',
    monthlyAmount: 19, // $19.00
    yearlyAmount: 190, // $190.00
    currency: 'usd',
  },
  proStudio: {
    name: 'RinaWarp Terminal Pro — Pro Studio',
    description: 'Professional access with monthly and yearly subscriptions',
    monthlyPriceId: 'price_1SMHplGZrRdZy3W9sBMAeg6m',
    yearlyPriceId: 'price_1SMHpmGZrRdZy3W96lAUsyNe',
    monthlyAmount: 39, // $39.00
    yearlyAmount: 390, // $390.00
    currency: 'usd',
  },
  studio: {
    name: 'RinaWarp Terminal Pro — Studio',
    description: 'Team access with monthly and yearly subscriptions',
    monthlyPriceId: 'price_1SMHpmGZrRdZy3W9g2EtVlNA',
    yearlyPriceId: 'price_1SMHpmGZrRdZy3W9SbGs02ir',
    monthlyAmount: 99, // $99.00
    yearlyAmount: 990, // $990.00
    currency: 'usd',
  },
  enterprise: {
    name: 'RinaWarp Terminal Pro — Enterprise',
    description: 'API + Cloud scaling with monthly and yearly subscriptions',
    monthlyPriceId: 'price_1SMHpnGZrRdZy3W9qc1Gh50N',
    yearlyPriceId: 'price_1SMHpnGZrRdZy3W9KcQE7m6D',
    monthlyAmount: 249, // $249.00
    yearlyAmount: 2490, // $2,490.00
    currency: 'usd',
  },
  founderAccess: {
    name: 'RinaWarp Terminal Pro — Founder Access',
    description: 'Lifetime access for founders',
    priceId: 'price_1SMHpnGZrRdZy3W9MaKf2Edm',
    amount: 799, // $799.00
    currency: 'usd',
    oneTime: true,
  },
  lifetimeLocal: {
    name: 'RinaWarp Terminal Pro — Lifetime Local License',
    description: 'Terminal-only local license',
    priceId: 'price_1SMHpoGZrRdZy3W9m8VsCudD',
    amount: 499, // $499.00
    currency: 'usd',
    oneTime: true,
  },
  free: {
    name: 'RinaWarp Terminal Pro — Free',
    description: 'Free plan for onboarding',
    priceId: 'price_1SMHpoGZrRdZy3W9jJ3Lk7cw',
    amount: 0,
    currency: 'usd',
    oneTime: true,
  },
};

// Helper to ensure price exists
const ensurePrice = async (stripeProduct, interval, amount, metadata) => {
  const prices = await stripe.prices.list({
    product: stripeProduct.id,
    active: true,
    limit: 10,
  });
  const exists = prices.data.find((p) => p.metadata.interval === interval);
  if (!exists) {
    await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: amount * 100,
      currency: 'usd',
      recurring: { interval },
      metadata,
    });
    console.log(
      `✅ Created ${interval} price for ${metadata.rinawarp_product}`
    );
  }
};

// Helper to ensure one-time price exists
const ensureOneTimePrice = async (stripeProduct, amount, metadata) => {
  const prices = await stripe.prices.list({
    product: stripeProduct.id,
    active: true,
    limit: 10,
  });
  const exists = prices.data.find((p) => p.metadata.type === 'one_time');
  if (!exists) {
    await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: amount * 100,
      currency: 'usd',
      metadata,
    });
    console.log(`✅ Created one-time price for ${metadata.rinawarp_product}`);
  }
};

// Create or get products and prices
async function ensureProductsExist() {
  console.log('🔧 Ensuring Stripe products exist...');

  for (const [key, product] of Object.entries(PRODUCTS)) {
    try {
      // Check if product exists
      const products = await stripe.products.list({
        active: true,
        metadata: {
          rinawarp_product: key,
        },
      });

      let stripeProduct;
      if (products.data.length === 0) {
        console.log(`📦 Creating product: ${product.name}`);

        // Create product
        stripeProduct = await stripe.products.create({
          name: product.name,
          description: product.description,
          metadata: {
            rinawarp_product: key,
          },
        });
        console.log(`✅ Created product: ${product.name}`);
      } else {
        stripeProduct = products.data[0];
        console.log(`✅ Product exists: ${product.name}`);
      }

      // Create prices if not exist
      if (product.monthlyAmount) {
        await ensurePrice(stripeProduct, 'month', product.monthlyAmount, {
          rinawarp_product: key,
          rinawarp_app: 'terminal-pro',
          interval: 'month',
        });
      }

      if (product.yearlyAmount) {
        await ensurePrice(stripeProduct, 'year', product.yearlyAmount, {
          rinawarp_product: key,
          rinawarp_app: 'terminal-pro',
          interval: 'year',
        });
      }

      if (product.amount && product.oneTime) {
        await ensureOneTimePrice(stripeProduct, product.amount, {
          rinawarp_product: key,
          rinawarp_app: 'terminal-pro',
          type: 'one_time',
        });
      }
    } catch (error) {
      console.error(`❌ Error creating product ${key}:`, error);
    }
  }
}

// Create checkout session for purchase
export async function createCheckoutSession(req, res) {
  console.log('🔄 Stripe createCheckoutSession called:', {
    priceId: req.body.priceId,
    product: req.body.product,
    interval: req.body.interval,
    success_url: req.body.success_url,
    cancel_url: req.body.cancel_url,
  });

  try {
    const { priceId, product, interval, success_url, cancel_url } = req.body;

    let priceIdToUse;
    let price;

    if (priceId) {
      // Use provided priceId
      priceIdToUse = priceId;
      price = await stripe.prices.retrieve(priceId);
    } else if (product && interval) {
      // Fetch price based on product and interval using metadata
      const prices = await stripe.prices.list({
        active: true,
        metadata: {
          rinawarp_product: product,
          interval: interval,
        },
        limit: 1,
      });
      if (prices.data.length === 0) {
        return res
          .status(400)
          .json({ error: 'Price not found for product and interval' });
      }
      priceIdToUse = prices.data[0].id;
      price = prices.data[0];
    } else {
      return res
        .status(400)
        .json({ error: 'Price ID or Product and Interval are required' });
    }

    const mode = price.recurring ? 'subscription' : 'payment';

    const session = await stripe.checkout.sessions.create({
      mode: mode,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceIdToUse,
          quantity: 1,
        },
      ],
      success_url: success_url,
      cancel_url: cancel_url,
      customer_email: req.body.customerEmail || undefined,
      metadata: {
        rinawarp_type: price.recurring ? 'subscription' : 'lifetime',
        rinawarp_price_id: priceIdToUse,
        rinawarp_product: price.metadata?.rinawarp_product || 'unknown',
        rinawarp_app: price.metadata?.rinawarp_app || 'terminal-pro',
      },
    });

    console.log('✅ Stripe checkout session created successfully:', {
      url: session.url,
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Stripe checkout session error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Handle Stripe webhooks
export async function handleWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const idempotencyKey = req.headers['idempotency-key'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    await addToDLQ(req.body, err.message, 'signature_verification_failed');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('🔔 Stripe webhook received:', event.type);

  // Check idempotency
  if (idempotencyKey) {
    const processed = await checkIdempotency(idempotencyKey, event.id);
    if (processed) {
      console.log('Idempotency key already processed:', idempotencyKey);
      return res.json({ received: true });
    }
  }

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

    // Mark idempotency as processed
    if (idempotencyKey) {
      await markIdempotency(idempotencyKey, event.id);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    await addToDLQ(req.body, error.message, 'handler_error');
    res.status(500).json({ error: error.message });
  }
}

// Handle successful checkout
async function handleCheckoutCompleted(session) {
  console.log('✅ Checkout completed:', session.id);

  const customerEmail = session.customer_email;
  const metadata = session.metadata;

  // Generate license based on product and app
  const product = metadata.rinawarp_product || 'unknown';
  const app = metadata.rinawarp_app || 'terminal-pro';
  let license = null;

  if (app === 'terminal-pro' && product in PRODUCTS) {
    const productConfig = PRODUCTS[product];
    let licenseType = 'personal';
    let maxUsage = 1000;

    if (product === 'studio' || product === 'enterprise') {
      licenseType = 'team';
      maxUsage = 5000;
    } else if (product === 'founderAccess' || product === 'lifetimeLocal') {
      licenseType = 'lifetime';
      maxUsage = 10000;
    }

    license = generateLicense(licenseType, maxUsage);
  } else if (app === 'amvc') {
    // Handle AMVC credits or subscriptions
    console.log('🎬 Activating AMVC access for:', customerEmail);
    // Add AMVC-specific logic here
  }

  // Send download instructions with license
  await sendDownloadInstructions(customerEmail, metadata, license);

  // Log the sale
  await logSale(session);
}

// Handle subscription created
async function handleSubscriptionCreated(subscription) {
  console.log('📅 Subscription created:', subscription.id);

  const customer = await stripe.customers.retrieve(subscription.customer);
  await sendDownloadInstructions(customer.email, {
    rinawarp_type: 'subscription',
  });
}

// Handle subscription updated
async function handleSubscriptionUpdated(subscription) {
  console.log('🔄 Subscription updated:', subscription.id);
  // Handle subscription changes
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription) {
  console.log('❌ Subscription deleted:', subscription.id);
  // Handle subscription cancellation
}

// Handle successful payment
async function handlePaymentSucceeded(invoice) {
  console.log('💰 Payment succeeded:', invoice.id);

  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription
    );
    const customer = await stripe.customers.retrieve(subscription.customer);

    // Send renewal confirmation
    await sendRenewalConfirmation(customer.email, subscription);
  }
}

// Handle failed payment
async function handlePaymentFailed(invoice) {
  console.log('💸 Payment failed:', invoice.id);

  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription
    );
    const customer = await stripe.customers.retrieve(subscription.customer);

    // Send payment failure notification
    await sendPaymentFailureNotification(customer.email, invoice);
  }
}

// Send download instructions
async function sendDownloadInstructions(email, metadata, license = null) {
  console.log(`📧 Sending download instructions to: ${email}`);

  // In a real implementation, you would:
  // 1. Generate a unique download link
  // 2. Send email with download instructions and license
  // 3. Log the download link for tracking

  // For now, just log
  console.log('Download instructions would be sent to:', email);
  console.log('Metadata:', metadata);
  if (license) {
    console.log('License:', license);
  }
}

// Send renewal confirmation
async function sendRenewalConfirmation(email, subscription) {
  console.log(`📧 Sending renewal confirmation to: ${email}`);
  // Send renewal email
}

// Send payment failure notification
async function sendPaymentFailureNotification(email, invoice) {
  console.log(`📧 Sending payment failure notification to: ${email}`);
  // Send payment failure email
}

// Log sale for analytics
async function logSale(session) {
  const saleData = {
    sessionId: session.id,
    customerEmail: session.customer_email,
    amount: session.amount_total,
    currency: session.currency,
    metadata: session.metadata,
    timestamp: new Date().toISOString(),
  };

  // Log to file (in production, use a database)
  const logFile = path.join(process.cwd(), 'logs', 'stripe', 'sales-log.json');
  let sales = [];

  if (fs.existsSync(logFile)) {
    sales = JSON.parse(await fs.promises.readFile(logFile, 'utf8'));
  }

  sales.push(saleData);
  await fs.promises.writeFile(logFile, JSON.stringify(sales, null, 2));

  console.log('💰 Sale logged:', saleData);
}

// Get sales analytics
export async function getSalesAnalytics(req, res) {
  try {
    const logFile = path.join(
      process.cwd(),
      'logs',
      'stripe',
      'sales-log.json'
    );

    if (!fs.existsSync(logFile)) {
      return res.json({ sales: [], totalRevenue: 0, totalSales: 0 });
    }

    const sales = JSON.parse(await fs.promises.readFile(logFile, 'utf8'));
    const totalRevenue = sales.reduce(
      (sum, sale) => sum + (sale.amount || 0),
      0
    );
    const totalSales = sales.length;

    res.json({
      sales,
      totalRevenue: totalRevenue / 100, // Convert from cents
      totalSales,
      currency: 'USD',
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Get lifetime sales count
export async function getLifetimeCount(req, res) {
  try {
    const logFile = path.join(
      process.cwd(),
      'logs',
      'stripe',
      'sales-log.json'
    );

    if (!fs.existsSync(logFile)) {
      return res.json({ sold: 0, remaining: 500 });
    }

    const sales = JSON.parse(await fs.promises.readFile(logFile, 'utf8'));
    const lifetimeSales = sales.filter(
      (sale) =>
        sale.metadata?.rinawarp_type === 'lifetime' ||
        sale.metadata?.rinawarp_product === 'founderAccess' ||
        sale.metadata?.rinawarp_product === 'lifetimeLocal'
    ).length;

    const remaining = Math.max(0, 500 - lifetimeSales);

    res.json({
      sold: lifetimeSales,
      remaining: remaining,
      total: 500,
    });
  } catch (error) {
    console.error('Lifetime count error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Add to DLQ
async function addToDLQ(eventBody, error, reason) {
  const dlqData = {
    event: eventBody,
    error: error,
    reason: reason,
    timestamp: new Date().toISOString(),
  };

  const dlqFile = path.join(
    process.cwd(),
    'logs',
    'stripe',
    'webhook-dlq.json'
  );
  let dlq = [];

  if (fs.existsSync(dlqFile)) {
    dlq = JSON.parse(await fs.promises.readFile(dlqFile, 'utf8'));
  }

  dlq.push(dlqData);
  await fs.promises.writeFile(dlqFile, JSON.stringify(dlq, null, 2));

  console.log('📝 Added to DLQ:', reason);
}

// Check idempotency
async function checkIdempotency(key, eventId) {
  const idempotencyFile = path.join(
    process.cwd(),
    'logs',
    'stripe',
    'idempotency.json'
  );
  let idempotency = {};

  if (fs.existsSync(idempotencyFile)) {
    idempotency = JSON.parse(
      await fs.promises.readFile(idempotencyFile, 'utf8')
    );
  }

  return idempotency[key] === eventId;
}

// Mark idempotency
async function markIdempotency(key, eventId) {
  const idempotencyFile = path.join(
    process.cwd(),
    'logs',
    'stripe',
    'idempotency.json'
  );
  let idempotency = {};

  if (fs.existsSync(idempotencyFile)) {
    idempotency = JSON.parse(
      await fs.promises.readFile(idempotencyFile, 'utf8')
    );
  }

  idempotency[key] = eventId;
  await fs.promises.writeFile(
    idempotencyFile,
    JSON.stringify(idempotency, null, 2)
  );
}

// Initialize products on startup
let initialized = false;

export async function initializeStripe() {
  if (initialized) return;
  initialized = true;

  if (process.env.STRIPE_SECRET_KEY) {
    await ensureProductsExist();
    console.log('✅ Stripe products initialized');
  } else {
    console.log('⚠️ Stripe not configured - skipping product initialization');
  }
}

export default {
  createCheckoutSession,
  handleWebhook,
  getSalesAnalytics,
  initializeStripe,
};
