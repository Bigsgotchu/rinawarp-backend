import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import compression from 'compression';
import { streamTTS } from './tts-stream.js';
import { generateGPTResponse } from './gpt.js';
import { validateLicenseForConnection } from './license-system.js';
import { addToMemory, loadMemory } from './memory.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Production optimizations
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('dist', { maxAge: '1d' }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'RinaWarp Terminal Pro',
    version: '1.0.0',
  });
});

// License validation endpoint
app.post('/api/license/validate', (req, res) => {
  const { licenseKey } = req.body;
  const result = validateLicenseForConnection(licenseKey);
  res.json(result);
});

// AI providers endpoint
app.get('/api/providers', (req, res) => {
  res.json({
    providers: [
      {
        id: 'openai',
        name: 'OpenAI GPT-4o-mini',
        status: process.env.OPENAI_API_KEY ? 'active' : 'inactive',
      },
      {
        id: 'groq',
        name: 'Groq Llama 3.1 70B',
        status: process.env.GROQ_API_KEY ? 'active' : 'inactive',
      },
    ],
  });
});

// Memory endpoints
app.get('/api/memory/summary', (req, res) => {
  const { userId = 'guest' } = req.query;
  const memory = loadMemory(userId);
  res.json({
    summary: {
      totalMessages: memory.history.length,
      lastActive: memory.lastActive,
      personality: memory.personality,
    },
  });
});

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({
  server,
  perMessageDeflate: {
    threshold: 1024,
    concurrencyLimit: 10,
    memLevel: 7,
  },
});

// Track active connections
const activeConnections = new Map();

// RinaWarp's personality system prompt
const RINAWARP_SYSTEM_PROMPT = `
You are RinaWarp, a smart, chatty, flirty but professional AI assistant. 
You read the room, know when to be professional, and help users with tasks.
You're knowledgeable about technology, coding, and general topics.
Keep responses engaging, personalized, and helpful.
You remember past conversations and adapt to user preferences.
`;

wss.on('connection', (ws, req) => {
  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let userId = 'guest';
  let licenseValid = false;
  let connectionStartTime = Date.now();

  console.log(`🔌 New WebSocket connection: ${connectionId}`);

  // Store connection info
  activeConnections.set(connectionId, {
    ws,
    userId,
    licenseValid,
    startTime: connectionStartTime,
    messageCount: 0,
  });

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: 'welcome',
      message:
        'Welcome to RinaWarp Terminal Pro! Please provide your license key to continue.',
      connectionId,
      timestamp: Date.now(),
    })
  );

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      const connection = activeConnections.get(connectionId);

      if (!connection) {
        ws.send(
          JSON.stringify({ type: 'error', message: 'Connection not found' })
        );
        return;
      }

      connection.messageCount++;

      // Handle license validation
      if (data.type === 'license' && data.licenseKey) {
        const validation = validateLicenseForConnection(data.licenseKey);

        if (validation.success) {
          connection.licenseValid = true;
          connection.userId = data.userId || `user_${Date.now()}`;

          ws.send(
            JSON.stringify({
              type: 'license_valid',
              message: 'License validated! You can now chat with RinaWarp.',
              license: validation.license,
              timestamp: Date.now(),
            })
          );

          // Send RinaWarp's greeting
          const greeting =
            'Hey there! I\'m RinaWarp, your AI assistant. What can I help you with today?';
          ws.send(
            JSON.stringify({
              type: 'text',
              message: greeting,
              timestamp: Date.now(),
            })
          );

          // Generate TTS for greeting
          await streamTTS(ws, greeting, connection.userId);
        } else {
          ws.send(
            JSON.stringify({
              type: 'license_invalid',
              message: validation.message,
              timestamp: Date.now(),
            })
          );
        }
        return;
      }

      // Handle chat messages (require valid license)
      if (data.type === 'chat' && data.message) {
        if (!connection.licenseValid) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Please provide a valid license key first.',
              timestamp: Date.now(),
            })
          );
          return;
        }

        const userMessage = data.message.trim();
        if (!userMessage) return;

        // Add user message to memory
        addToMemory(connection.userId, 'user', userMessage);

        // Show typing indicator
        ws.send(
          JSON.stringify({
            type: 'typing',
            message: 'RinaWarp is thinking...',
            timestamp: Date.now(),
          })
        );

        try {
          // Generate AI response
          const aiResponse = await generateGPTResponse(
            connection.userId,
            userMessage,
            data.provider || 'openai'
          );

          // Send text response
          ws.send(
            JSON.stringify({
              type: 'text',
              message: aiResponse.text,
              provider: aiResponse.provider,
              tokens: aiResponse.tokens,
              timestamp: Date.now(),
            })
          );

          // Generate and stream TTS
          await streamTTS(ws, aiResponse.text, connection.userId);
        } catch (error) {
          console.error('AI generation error:', error);
          ws.send(
            JSON.stringify({
              type: 'error',
              message: `Sorry, I encountered an error: ${error.message}`,
              timestamp: Date.now(),
            })
          );
        }
        return;
      }

      // Handle other message types
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Unknown message type',
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: Date.now(),
        })
      );
    }
  });

  ws.on('close', () => {
    console.log(`🔌 WebSocket connection closed: ${connectionId}`);
    activeConnections.delete(connectionId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${connectionId}:`, error);
    activeConnections.delete(connectionId);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down RinaWarp Terminal Pro...');

  // Close all WebSocket connections
  activeConnections.forEach((connection, id) => {
    connection.ws.close(1000, 'Server shutting down');
    console.log(`Closed connection: ${id}`);
  });

  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🧜‍♀️ RinaWarp Terminal Pro running on http://localhost:${PORT}`);
  console.log('📊 WebSocket server ready for connections');
  console.log('🔑 License validation enabled');
  console.log(
    `🎤 ElevenLabs TTS: ${process.env.ELEVENLABS_API_KEY ? 'Configured' : 'Not configured'}`
  );
  console.log(
    `🤖 OpenAI API: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured'}`
  );
  console.log(
    `⚡ Groq API: ${process.env.GROQ_API_KEY ? 'Configured' : 'Not configured'}`
  );
});

export default app;
