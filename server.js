/**
 * =====================================================
 *  RinaWarp Terminal Pro — Production Backend Server
 * =====================================================
 * 100% Render-compatible version with safe dynamic monitoring import
 * =====================================================
 */

// -----------------------------------------------------
// Load environment BEFORE anything else
// -----------------------------------------------------
import dotenv from 'dotenv';
import fs from 'fs';

// Auto-select environment file
const envFile =
  process.env.NODE_ENV === 'production' && fs.existsSync('./.env.production')
    ? './.env.production'
    : fs.existsSync('./.env.development')
      ? './.env.development'
      : './.env.example';

dotenv.config({ path: envFile });

// -----------------------------------------------------
// FIXED: Dynamic import for monitoring (no static deps)
// -----------------------------------------------------
const { initMonitoring } = await import("./monitoring.js");
await initMonitoring();

console.log(`🌍 Using environment file: ${envFile}`);

// -----------------------------------------------------
// AFTER monitoring loads, import everything else
// -----------------------------------------------------
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import Stripe from 'stripe';

import logger from './src/utils/logger.js';
import aiRoutes from './routes/ai.js';
import stripeRoutes from './routes/stripe-production.js';
import stripeWebhookRoutes from './routes/stripe-webhook.js';
import licenseRoutes from './routes/license.js';
import aiCreditsCheckoutRoutes from './routes/aiCreditsCheckout.js';
import licenseActivationRoutes from './routes/license-activation.js';
import lifetimeSpotsRoutes from './routes/lifetime-spots.js';
import feedbackRoutes from './routes/feedback.js';
import cliRoutes from './routes/cli.js';
import musicVideoAdminRoutes from './routes/music-video-admin.js';
import terminalRoutes from './src/routes/terminalRoutes.js';
import downloadsRoutes from './routes/downloads.js';
import dashboardRoutes from './routes/dashboard.js';
import testMonetizationRoutes from './routes/test-monetization.js';
import terminalLicenseRoutes from './routes/terminal-license.js';
import { attachTerminalSocket } from './src/backend/terminal/terminalSocket.js';

// -----------------------------------------------------
// Server INIT
// -----------------------------------------------------
logger.info('SERVER', `🌍 Loaded environment from ${envFile}`);

const app = express();
const PORT = process.env.PORT || 8080;

// -----------------------------------------------------
// Security
// -----------------------------------------------------
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// -----------------------------------------------------
// CORS
// -----------------------------------------------------
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || [
    'https://rinawarptech.com',
    'https://main--rinawarp-terminal-pro.netlify.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-license-key',
    'x-user-email',
    'x-user-tier'
  ]
};

app.use(cors(corsOptions));

// -----------------------------------------------------
// Body parsing
// -----------------------------------------------------
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// -----------------------------------------------------
// Rate Limiting (basic)
// -----------------------------------------------------
const requestCounts = new Map();
app.use((req, res, next) => {
  const ip = req.ip;
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
  const maxReq = parseInt(process.env.RATE_LIMIT_MAX) || 120;

  const now = Date.now();
  const windowStart = now - windowMs;

  // Trim old
  for (const [key, timestamps] of requestCounts.entries()) {
    requestCounts.set(key, timestamps.filter(t => t > windowStart));
    if (requestCounts.get(key).length === 0) requestCounts.delete(key);
  }

  const timestamps = requestCounts.get(ip) || [];
  if (timestamps.length >= maxReq) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((timestamps[0] + windowMs - now) / 1000)
    });
  }

  timestamps.push(now);
  requestCounts.set(ip, timestamps);

  next();
});

// -----------------------------------------------------
// Health Check
// -----------------------------------------------------
app.get('/api/health', (req, res) => {
  logger.info('HEALTH', 'Health check');
  res.json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// -----------------------------------------------------
// API ROUTES
// -----------------------------------------------------
app.use('/api/ai', aiRoutes);
app.use('/api/stripe', stripeRoutes);

// Stripe checkout logic
app.get('/api/billing/checkout', async (req, res) => {
  const { tier } = req.query;

  const priceMap = {
    starter: process.env.STRIPE_PRICE_ID_STARTER,
    creator: process.env.STRIPE_PRICE_ID_CREATOR,
    pro: process.env.STRIPE_PRICE_ID_PRO,
    pioneer: process.env.STRIPE_PRICE_ID_PIONEER,
    founder: process.env.STRIPE_PRICE_ID_FOUNDER
  };

  const priceId = priceMap[tier?.toLowerCase()];

  if (!priceId) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid tier',
      availableTiers: Object.keys(priceMap)
    });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const mode = ['pioneer', 'founder'].includes(tier)
      ? 'payment'
      : 'subscription';

    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        process.env.STRIPE_SUCCESS_URL ||
        'https://rinawarptech.com/terminal-pro/account?success=true',
      cancel_url:
        process.env.STRIPE_CANCEL_URL ||
        'https://rinawarptech.com/terminal-pro/pricing',
      metadata: { tier }
    });

    res.redirect(303, session.url);
  } catch (e) {
    logger.error('STRIPE', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Stripe Webhooks
app.use('/webhooks/stripe', stripeWebhookRoutes);

// License Routes
app.use('/api/license', licenseRoutes);
app.use('/api/license', lifetimeSpotsRoutes);
app.use('/api/license', terminalLicenseRoutes);
app.use('/api/license', licenseActivationRoutes);

app.use('/api/feedback', feedbackRoutes);
app.use('/api/cli', cliRoutes);
app.use('/api/admin/music-video', musicVideoAdminRoutes);
app.use('/api/terminal', terminalRoutes);
app.use('/api/ai-credits/checkout', aiCreditsCheckoutRoutes);
app.use('/api/downloads', downloadsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/test', testMonetizationRoutes);

// -----------------------------------------------------
// 404 Handler
// -----------------------------------------------------
app.use('*', (req, res) => {
  res.status(404).json({ ok: false, error: 'Endpoint not found' });
});

// -----------------------------------------------------
// Create HTTP + WebSocket Server
// -----------------------------------------------------
const server = createServer(app);

attachTerminalSocket(server, {
  path: '/ws/terminal',
  cwd: process.cwd(),
  env: process.env
});

// -----------------------------------------------------
// Start Server
// -----------------------------------------------------
server
  .listen(PORT, () => {
    logger.success('SERVER', `🚀 Backend running on port ${PORT}`);
  })
  .on('error', (err) => {
    logger.error('SERVER', err.message);
    process.exit(1);
  });

// -----------------------------------------------------
// Graceful Shutdown
// -----------------------------------------------------
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());

export { server, app };
