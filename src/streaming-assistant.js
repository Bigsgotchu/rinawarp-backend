import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { generateToken, authMiddleware } from './middleware/auth.mjs';

dotenv.config();

// Validation schemas
const licenseSchema = z.object({
  licenseKey: z.string().min(1, 'License key is required'),
});

const aiSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  provider: z.string().optional(),
});

const assistantSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  voice: z.string().optional(),
  provider: z.string().optional(),
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(limiter);

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

// ===========================
// Health check endpoint
// ===========================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'RinaWarp Streaming Assistant',
  });
});

// ===========================
// AI Providers endpoint
// ===========================
app.get('/api/providers', (req, res) => {
  res.json({
    providers: [
      { id: 'openai', name: 'OpenAI GPT-4o-mini', status: 'active' },
      { id: 'groq', name: 'Groq Llama 3.1 70B', status: 'active' },
    ],
  });
});

// ===========================
// Real-time GPT + TTS streaming
// ===========================
app.post('/api/assistant-stream', authMiddleware, async (req, res) => {
  try {
    const {
      prompt,
      voice = 'Rachel',
      provider = 'openai',
    } = assistantSchema.parse(req.body);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // --- Step 1: Get GPT response streaming ---
    const apiKey =
      provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.GROQ_API_KEY;
    const apiUrl =
      provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.groq.com/openai/v1/chat/completions';

    const gptResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:
          provider === 'openai' ? 'gpt-4o-mini' : 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You are RinaWarp, a helpful AI assistant with a friendly, professional personality. Keep responses concise and helpful.',
          },
          { role: 'user', content: prompt },
        ],
        stream: true,
      }),
    });

    if (!gptResponse.ok) {
      throw new Error(
        `API request failed: ${gptResponse.status} ${gptResponse.statusText}`
      );
    }

    const reader = gptResponse.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullResponse = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // GPT stream comes in chunks; extract text pieces
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete chunk for next iteration

      for (let line of lines) {
        line = line.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.replace(/^data: /, '');
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const word = parsed.choices?.[0]?.delta?.content;
          if (!word) continue;

          fullResponse += word;

          // --- Step 2: Convert GPT text chunk to audio (if ElevenLabs is configured) ---
          if (process.env.ELEVENLABS_API_KEY) {
            try {
              const ttsRes = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': process.env.ELEVENLABS_API_KEY,
                  },
                  body: JSON.stringify({
                    text: word,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                      stability: 0.5,
                      similarity_boost: 0.5,
                    },
                  }),
                }
              );

              if (ttsRes.ok) {
                const audioBuffer = await ttsRes.arrayBuffer();
                const base64Audio = Buffer.from(audioBuffer).toString('base64');

                // --- Step 3: Send audio chunk to client ---
                res.write(
                  `data: ${JSON.stringify({
                    word,
                    audio: base64Audio,
                    fullResponse: fullResponse,
                  })}\n\n`
                );
              } else {
                // Send text without audio if TTS fails
                res.write(
                  `data: ${JSON.stringify({
                    word,
                    audio: null,
                    fullResponse: fullResponse,
                  })}\n\n`
                );
              }
            } catch (ttsError) {
              // Send text without audio if TTS fails
              res.write(
                `data: ${JSON.stringify({
                  word,
                  audio: null,
                  fullResponse: fullResponse,
                })}\n\n`
              );
            }
          } else {
            // Send text without audio if ElevenLabs not configured
            res.write(
              `data: ${JSON.stringify({
                word,
                audio: null,
                fullResponse: fullResponse,
              })}\n\n`
            );
          }
        } catch (parseError) {
          console.error('Error parsing GPT response:', parseError);
          continue;
        }
      }
    }

    // End streaming
    res.write(`event: done\ndata: ${JSON.stringify({ fullResponse })}\n\n`);
    res.end();
  } catch (err) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors });
    } else {
      console.error('Streaming error:', err);
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`
      );
      res.end();
    }
  }
});

// ===========================
// Legacy endpoints for compatibility
// ===========================
app.post('/api/ai-stream', async (req, res) => {
  // Redirect to new streaming endpoint
  req.url = '/api/assistant-stream';
  app._router.handle(req, res);
});

app.post('/api/ai', authMiddleware, async (req, res) => {
  try {
    const { prompt, provider = 'openai' } = aiSchema.parse(req.body);

    const apiKey =
      provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.GROQ_API_KEY;
    const apiUrl =
      provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.groq.com/openai/v1/chat/completions';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:
          provider === 'openai' ? 'gpt-4o-mini' : 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You are RinaWarp, a helpful AI assistant with a friendly, professional personality.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
      }),
    });

    const data = await response.json();
    res.json({
      response: data.choices[0].message.content,
      provider: provider,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ===========================
// Memory endpoints (simplified)
// ===========================
app.get('/api/memory/summary', (req, res) => {
  res.json({
    summary: {
      totalConversations: 0,
      lastActivity: new Date().toISOString(),
    },
  });
});

// ===========================
// Payment endpoints (simplified)
// ===========================
app.post('/api/checkout', (req, res) => {
  res.status(501).json({
    error: 'Payment system not configured',
    message: 'Please configure Stripe API keys to enable payments',
  });
});

app.post('/api/license/validate', (req, res) => {
  try {
    const { licenseKey } = licenseSchema.parse(req.body);
    console.log(`[STREAMING ASSISTANT] Validating license key: ${licenseKey}`);
    const validKey = process.env.VALID_LICENSE_KEY || 'RINAWARP-PRO-123';
    const valid = licenseKey === validKey;
    console.log(`[STREAMING ASSISTANT] License valid: ${valid}`);
    if (valid) {
      const token = generateToken({ licenseKey, userId: 'user123' });
      res.json({
        valid,
        reason: 'Valid license',
        token,
      });
    } else {
      res.json({
        valid,
        reason: 'Invalid license key',
      });
    }
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
});

// ===========================
// Start server
// ===========================
app.listen(PORT, () => {
  console.log(
    `🧜‍♀️ RinaWarp Streaming Assistant running at http://localhost:${PORT}`
  );
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🤖 AI streaming: http://localhost:${PORT}/api/assistant-stream`);
});

export default app;
