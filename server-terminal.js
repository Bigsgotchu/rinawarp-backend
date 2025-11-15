/**
 * =====================================================
 *  RinaWarp Terminal Pro — Minimal Backend Server
 * =====================================================
 * Test server with only terminal functionality
 * =====================================================
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
import logger from './src/utils/logger.js';
import terminalRoutes from './src/routes/terminalRoutes.js';
import { attachTerminalSocket } from './src/ws/terminalSocket.js';
// Import AI functionality
import { registerTerminalAiRoute } from '../src/backend/terminal/aiTerminalRoute.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Terminal routes
app.use('/api/terminal', terminalRoutes);

// Register AI terminal route
try {
  registerTerminalAiRoute(app);
  logger.info('SERVER', '🧜‍♀️ Rina AI terminal route registered successfully');
} catch (error) {
  logger.warn('SERVER', '⚠️ Failed to register terminal AI route:', error.message);
}

// Error handling
app.use((err, req, res, next) => {
  logger.error('ERROR', `Unhandled error: ${err.message}`);
  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Endpoint not found'
  });
});

// Create HTTP server
const server = createServer(app);

// Terminal WebSocket integration
const terminalWss = attachTerminalSocket(server, {
  path: '/ws/terminal',
  cwd: process.cwd(),
  env: process.env
});

logger.info('SERVER', '🔌 Terminal WebSocket server attached');

// Start server
server.listen(PORT, () => {
  logger.success('SERVER', `🚀 RinaWarp Terminal Pro backend running on port ${PORT}`);
  logger.info('SERVER', `🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('SERVER', `🔒 CORS Origins: ${corsOptions.origin.join(', ')}`);
  logger.info('SERVER', `🔌 WebSocket Endpoint: ws://localhost:${PORT}/ws/terminal`);
  logger.info('SERVER', `🖥️ Terminal REST API: http://localhost:${PORT}/api/terminal`);
  logger.rina(`Backend initialized and ready to serve!`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error('SERVER', `❌ Port ${PORT} is already in use!`);
    process.exit(1);
  } else {
    logger.error('SERVER', `Failed to start server: ${err.message}`);
    process.exit(1);
  }
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info('SERVER', `\n${signal} received. Starting graceful shutdown...`);
  
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