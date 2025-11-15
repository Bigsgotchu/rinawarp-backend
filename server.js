/**
 * =====================================================
 *  RinaWarp Terminal Pro — Production Backend Server
 * =====================================================
 * Production-ready Express server with security, AI, payments, and terminal
 * =====================================================
 */

// Load environment variables FIRST (before any imports)
import dotenv from 'dotenv';
import fs from 'fs';

// Auto-detect which .env to load
const envFile = fs.existsSync('../.env.production') && process.env.NODE_ENV === 'production'
  ? '../.env.production'
  : fs.existsSync('../.env.development')
    ? '../.env.development'
    : '../.env.example'; // fallback

dotenv.config({ path: envFile });

import { initMonitoring } from "./monitoring.js";

// Initialize monitoring (safe + optional)
await initMonitoring();

// Log after environment is loaded
console.log(`🌍 Using environment file: ${envFile}`);

// Now safe to import other modules that may use environment variables
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

logger.info('SERVER', `🌍 Loaded environment from ${envFile}`);

const app = express();
const PORT = process.env.PORT || 8080;

// --- Security Middleware ---
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false, // Handled by Nginx
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || ['https://rinawarptech.com', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-license-key', 'x-user-email', 'x-user-tier']
};
app.use(cors(corsOptions));

// Body parsing with limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Rate limiting (basic implementation - consider using express-rate-limit)
const requestCounts = new Map();
app.use((req, res, next) => {
  const clientIP = req.ip;
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX) || 120;

  const now = Date.now();
  const windowStart = now - windowMs;

  // Clean old entries
  for (const [ip, timestamps] of requestCounts.entries()) {
    requestCounts.set(ip, timestamps.filter(ts => ts > windowStart));
    if (requestCounts.get(ip).length === 0) {
      requestCounts.delete(ip);
    }
  }

  // Check rate limit
  const timestamps = requestCounts.get(clientIP) || [];
  if (timestamps.length >= maxRequests) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((timestamps[0] + windowMs - now) / 1000)
    });
  }

  // Add current request
  timestamps.push(now);
  requestCounts.set(clientIP, timestamps);

  next();
});

// --- Public Routes ---
app.get('/api/health', (req, res) => {
  logger.info('HEALTH', 'Health check requested');
  res.json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// --- API Routes ---
app.use('/api/ai', aiRoutes);
app.use('/api/stripe', stripeRoutes);

// Billing checkout route (maps tiers to live Stripe product IDs)
app.get('/api/billing/checkout', async (req, res) => {
  const { tier } = req.query;
  
  // Map tiers to LIVE Stripe price IDs from environment
  const tierPriceMap = {
    'starter': process.env.STRIPE_PRICE_ID_STARTER,
    'creator': process.env.STRIPE_PRICE_ID_CREATOR,
    'pro': process.env.STRIPE_PRICE_ID_PRO,
    'pioneer': process.env.STRIPE_PRICE_ID_PIONEER,
    'founder': process.env.STRIPE_PRICE_ID_FOUNDER
  };
  
  const priceId = tierPriceMap[tier?.toLowerCase()];
  
  if (!priceId) {
    logger.error('BILLING', `Invalid tier specified: ${tier}`);
    return res.status(400).json({
      ok: false,
      error: 'Invalid tier specified',
      availableTiers: Object.keys(tierPriceMap)
    });
  }
  
  try {
    // Redirect to Stripe Checkout (using live price ID from environment)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    logger.info('BILLING', `Creating checkout for tier: ${tier}, priceId: ${priceId}`);
    
    const session = await stripe.checkout.sessions.create({
      mode: tier === 'pioneer' || tier === 'founder' ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL || 'https://rinawarptech.com/terminal-pro/account?success=true',
      cancel_url: process.env.STRIPE_CANCEL_URL || 'https://rinawarptech.com/terminal-pro/pricing',
      metadata: {
        rinawarp_type: tier === 'pioneer' || tier === 'founder' ? 'lifetime' : 'subscription',
        rinawarp_tier: tier
      },
    });
    
    logger.success('BILLING', `Checkout session created successfully for ${tier}`);
    res.redirect(303, session.url);
  } catch (error) {
    logger.error('STRIPE', `Billing checkout error for ${tier}: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to create checkout session',
      tier: tier
    });
  }
});

// Stripe webhook route - must come before express.json() and use raw body parsing
app.use('/webhooks/stripe', stripeWebhookRoutes);

// License activation API routes (from webhook file)
app.use('/api/license', stripeWebhookRoutes);

app.use('/api/license', licenseRoutes);
app.use('/api/license', lifetimeSpotsRoutes);  // Mount under /api/license for download page compatibility
app.use('/api/license', terminalLicenseRoutes); // New Prisma-based terminal license routes
app.use('/api/feedback', feedbackRoutes);
app.use('/api/cli', cliRoutes);
app.use('/api/admin/music-video', musicVideoAdminRoutes);
app.use('/api/terminal', terminalRoutes);
app.use('/api/ai-credits/checkout', aiCreditsCheckoutRoutes);
app.use('/api/license', licenseActivationRoutes);
app.use('/api/downloads', downloadsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/test', testMonetizationRoutes);

// --- Error Handling ---
app.use((err, req, res, next) => {
  logger.error('ERROR', `Unhandled error: ${err.message}`);
  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// --- 404 Handler ---
app.use('*', (req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Endpoint not found'
  });
});

// --- Create HTTP Server ---
const server = createServer(app);

// --- Terminal WebSocket Integration ---
const terminalWss = attachTerminalSocket(server, {
  path: '/ws/terminal',
  cwd: process.cwd(),
  env: process.env
});

logger.info('SERVER', '🔌 Terminal WebSocket server attached');

// --- Start Server ---
server.listen(PORT, () => {
  logger.success('SERVER', `🚀 RinaWarp backend running on port ${PORT}`);
  logger.info('SERVER', `🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('SERVER', `🔒 CORS Origins: ${corsOptions.origin.join(', ')}`);
  logger.info('SERVER', `🔌 WebSocket Endpoint: ws://localhost:${PORT}/ws/terminal`);
  logger.info('SERVER', `🖥️ Terminal REST API: http://localhost:${PORT}/api/terminal`);
  logger.rina(`Backend initialized and ready to serve!`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error('SERVER', `❌ Port ${PORT} is already in use!`);
    logger.info('SERVER', `💡 Try running: npm run kill-backend`);
    logger.info('SERVER', `💡 Or manually: kill -9 $(lsof -t -i:${PORT})`);
    process.exit(1);
  } else {
    logger.error('SERVER', `Failed to start server: ${err.message}`);
    process.exit(1);
  }
});

// --- Graceful Shutdown ---
const gracefulShutdown = (signal) => {
  logger.info('SERVER', `\n${signal} received. Starting graceful shutdown...`);
  
  // Close WebSocket server
  if (terminalWss) {
    terminalWss.close(() => {
      logger.info('SERVER', '✅ Terminal WebSocket server closed');
    });
  }
  
  server.close(() => {
    logger.success('SERVER', '✅ HTTP server closed successfully');
    logger.info('SERVER', '👋 Goodbye!');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('SERVER', '⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  logger.error('SERVER', `Uncaught Exception: ${err.message}`);
  logger.error('SERVER', err.stack);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('SERVER', `Unhandled Rejection at: ${promise}, reason: ${reason}`);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Export for Electron
export { server, app };
