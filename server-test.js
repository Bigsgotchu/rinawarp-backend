/**
 * =====================================================
 *  RinaWarp Admin Test Server
 * =====================================================
 * Simple test server for AI Music Video Creator admin
 * =====================================================
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import musicVideoAdminRoutes from './routes/music-video-admin.js';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080', 'https://rinawarptech.com'],
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Basic rate limiting
const requestCounts = new Map();
app.use((req, res, next) => {
  const clientIP = req.ip;
  const timestamps = requestCounts.get(clientIP) || [];
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window
  
  // Clean old entries
  const validTimestamps = timestamps.filter(ts => ts > windowStart);
  requestCounts.set(clientIP, validTimestamps);
  
  // Check rate limit (120 requests per minute)
  if (validTimestamps.length >= 120) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: 60
    });
  }
  
  // Add current request
  validTimestamps.push(now);
  requestCounts.set(clientIP, validTimestamps);
  
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'RinaWarp Admin Test Server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0-admin-test'
  });
});

// Admin routes
app.use('/api/admin/music-video', musicVideoAdminRoutes);

// Basic error handling
app.use((err, req, res, next) => {
  console.error('ERROR:', err.message);
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

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 RinaWarp Admin Test Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 Admin routes: /api/admin/music-video/*`);
  console.log(`🎯 Test URL: http://localhost:${PORT}/api/health`);
  
  // Create data directory if it doesn't exist
  const dataDir = '../data/music-video';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory:', dataDir);
  }
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    process.exit(1);
  } else {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.log('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});