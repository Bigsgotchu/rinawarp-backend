/**
 * =====================================================
 *  RinaWarp Terminal Pro — Production Backend Server
 * =====================================================
 * Production-ready Express server with security, AI, and payments
 * =====================================================
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import logger from './utils/logger.js';
import aiRoutes from './routes/ai.js';
import stripeRoutes from './routes/stripe-production.js';
import licenseRoutes from './routes/license.js';
import cliRoutes from './routes/cli.js';

// Auto-detect which .env to load
const envFile = fs.existsSync('../.env.production') && process.env.NODE_ENV === 'production'
  ? '../.env.production'
  : '../.env.development';

dotenv.config({ path: envFile });
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
  origin: process.env.CORS_ORIGINS?.split(',') || ['https://rinawarptech.com'],
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
app.use('/api/license', licenseRoutes);
app.use('/api/cli', cliRoutes);

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

// --- Start Server ---
const server = app.listen(PORT, () => {
  logger.success('SERVER', `🚀 RinaWarp backend running on port ${PORT}`);
  logger.info('SERVER', `🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('SERVER', `🔒 CORS Origins: ${corsOptions.origin.join(', ')}`);
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
  
  server.close(() => {
    logger.success('SERVER', '✅ Server closed successfully');
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
