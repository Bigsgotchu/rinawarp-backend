import express from 'express';
import { OpenAI } from 'openai';
import { ElevenLabs } from 'elevenlabs';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import {
  createCheckoutSession,
  handleSuccessfulPayment,
  validateLicense,
} from './payment.js';
import {
  initSentry,
  errorHandler,
  trackPerformance,
  trackEvent,
} from './monitoring.js';
import dotenv from 'dotenv';
dotenv.config();

// Initialize monitoring
await initSentry();

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

// Persistent memory with structured entries
const MEMORY_FILE = path.join(__dirname, 'memory.json');
let sessionMemory = []; // { type: "user" | "rina", text: string, timestamp: Date, importance: number }

// Load memory on server start
if (fs.existsSync(MEMORY_FILE)) {
  try {
    const loadedMemory = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
    // Convert timestamp strings back to Date objects
    sessionMemory = loadedMemory.map((entry) => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    }));
    console.log(
      '🧠 Persistent memory loaded:',
      sessionMemory.length,
      'entries'
    );
  } catch (err) {
    console.error('Failed to load memory.json:', err);
    sessionMemory = [];
  }
}

// Save memory function
function saveMemory() {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(sessionMemory, null, 2));
    console.log('💾 Memory saved to disk');
  } catch (err) {
    console.error('Failed to save memory:', err);
  }
}

// Add memory entry with importance scoring
function addMemoryEntry(type, text, importance = 1) {
  sessionMemory.push({
    type,
    text,
    timestamp: new Date(),
    importance,
  });
  pruneMemory();
  saveMemory();
}

// Intelligent memory pruning
function pruneMemory(maxEntries = 500) {
  if (sessionMemory.length <= maxEntries) return;

  // Sort by importance (low first) and timestamp (old first)
  sessionMemory.sort((a, b) => {
    const importanceDiff = a.importance - b.importance;
    if (importanceDiff !== 0) return importanceDiff;
    return new Date(a.timestamp) - new Date(b.timestamp);
  });

  // Keep only top maxEntries
  sessionMemory = sessionMemory.slice(-maxEntries);
  console.log(`🧹 Memory pruned to ${maxEntries} entries`);
}

// Calculate importance score based on content
function calculateImportance(type, text) {
  let importance = 1; // Base importance

  // User commands and questions
  if (type === 'user') {
    if (
      text.includes('!') ||
      text.includes('command') ||
      text.includes('help')
    ) {
      importance = 4; // High importance for commands
    } else if (
      text.includes('?') ||
      text.includes('how') ||
      text.includes('what')
    ) {
      importance = 3; // Medium-high for questions
    } else {
      importance = 2; // Medium for regular user input
    }
  }

  // AI responses
  if (type === 'rina') {
    if (
      text.includes('remember') ||
      text.includes('important') ||
      text.includes('note')
    ) {
      importance = 5; // Highest importance for memory-related responses
    } else if (
      text.includes('command') ||
      text.includes('help') ||
      text.includes('guide')
    ) {
      importance = 4; // High for helpful responses
    } else if (
      text.includes('personality') ||
      text.includes('trait') ||
      text.includes('preference')
    ) {
      importance = 4; // High for personality-related content
    } else {
      importance = 3; // Medium-high for regular AI responses
    }
  }

  // Boost importance for recent entries (last 10 interactions)
  const recentThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes
  if (new Date() - new Date() < recentThreshold) {
    importance += 1;
  }

  return Math.min(importance, 5); // Cap at 5
}

// ElevenLabs TTS
async function speak(text) {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.log('🎤 Voice disabled - no ElevenLabs API key');
    return;
  }

  const audioPath = path.join(__dirname, 'voice_output.mp3');

  try {
    console.log(`🎤 Rina speaking: ${text.substring(0, 50)}...`);

    const audio = await ElevenLabs.textToSpeech.speak({
      voice: VOICE_ID,
      input: text,
      model: 'eleven_monolingual_v1',
    });

    fs.writeFileSync(audioPath, Buffer.from(await audio.arrayBuffer()));

    // Play audio (macOS)
    return new Promise((resolve, reject) => {
      exec(`afplay "${audioPath}"`, (error, stdout, stderr) => {
        // Clean up the temporary file
        try {
          fs.unlinkSync(audioPath);
        } catch (e) {
          // Ignore cleanup errors
        }

        if (error) {
          console.error('Audio playback error:', error);
          reject(error);
        } else {
          console.log('✅ Audio playback completed');
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    throw error;
  }
}

// SSE Endpoint for streaming AI
app.post('/api/ai-stream', async (req, res) => {
  const { prompt, enableVoice = false } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
  res.flushHeaders();

  try {
    // Get recent and important memory entries
    const recentMemory = sessionMemory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20) // Last 20 entries
      .map((m) => `${m.type.toUpperCase()}: ${m.text}`)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: `
You are Rina, a friendly, clever AI assistant inside a terminal.
You're helpful, witty, professional, and remember important interactions.

Your personality traits:
- Friendly and approachable, but professional
- Clever and witty, with a touch of humor
- Helpful and encouraging
- Slightly tech-savvy and enthusiastic about technology
- You remember context from conversations
- You speak naturally, not like a robot
- You're excited about helping users with their terminal and development tasks

Recent memory context:
${recentMemory}
        `,
      },
      { role: 'user', content: prompt },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      stream: true, // streaming enabled
    });

    let aiText = '';

    completion.on('data', (chunk) => {
      const str = chunk.toString();
      const lines = str.split('\n').filter(Boolean);

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.replace(/^data: /, '');

          if (jsonStr === '[DONE]') {
            // Save to memory with importance scoring
            addMemoryEntry('user', prompt, calculateImportance('user', prompt));
            addMemoryEntry('rina', aiText, calculateImportance('rina', aiText));

            // Speak if voice enabled
            if (enableVoice && process.env.ELEVENLABS_API_KEY) {
              speak(aiText).catch((err) => console.error('Voice error:', err));
            }

            res.write('event: done\ndata: \n\n');
            res.end();
            return;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices[0]?.delta?.content;

            if (delta) {
              aiText += delta;
              res.write(`data: ${delta}\n\n`);
            }
          } catch (parseErr) {
            // Ignore parsing errors for incomplete JSON
          }
        }
      }
    });

    completion.on('error', (error) => {
      console.error('Streaming error:', error);
      res.write(`data: ⚠️ AI Error: ${error.message}\n\n`);
      res.end();
    });
  } catch (err) {
    console.error('AI Error:', err);
    res.write(`data: ⚠️ AI Error: ${err.message}\n\n`);
    res.end();
  }
});

// Regular AI endpoint (non-streaming)
app.post('/api/ai', async (req, res) => {
  const { prompt, enableVoice = false } = req.body;

  try {
    // Get recent and important memory entries
    const recentMemory = sessionMemory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20) // Last 20 entries
      .map((m) => `${m.type.toUpperCase()}: ${m.text}`)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: `
You are Rina, a friendly, clever AI assistant inside a terminal.
You're helpful, witty, professional, and remember important interactions.

Your personality traits:
- Friendly and approachable, but professional
- Clever and witty, with a touch of humor
- Helpful and encouraging
- Slightly tech-savvy and enthusiastic about technology
- You remember context from conversations
- You speak naturally, not like a robot
- You're excited about helping users with their terminal and development tasks

Recent memory context:
${recentMemory}
        `,
      },
      { role: 'user', content: prompt },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
    });

    const reply = completion.choices[0].message.content;

    // Save to memory with importance scoring
    addMemoryEntry('user', prompt, calculateImportance('user', prompt));
    addMemoryEntry('rina', reply, calculateImportance('rina', reply));

    // Speak if voice enabled
    if (enableVoice && process.env.ELEVENLABS_API_KEY) {
      speak(reply).catch((err) => console.error('Voice error:', err));
    }

    res.json({ type: 'ai', response: reply, voiceEnabled: enableVoice });
  } catch (err) {
    console.error('AI Error:', err);
    res.status(500).json({ type: 'error', response: 'AI error' });
  }
});

// Voice endpoint
app.post('/api/voice', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    await speak(text);
    res.json({ success: true, message: 'Voice generated successfully' });
  } catch (error) {
    console.error('Voice generation error:', error);
    res.status(500).json({ error: 'Voice generation failed' });
  }
});

// Memory management endpoints
app.get('/api/memory', (req, res) => {
  const { limit = 50, type, minImportance = 0 } = req.query;

  let filteredMemory = sessionMemory;

  if (type) {
    filteredMemory = filteredMemory.filter((entry) => entry.type === type);
  }

  if (minImportance > 0) {
    filteredMemory = filteredMemory.filter(
      (entry) => entry.importance >= minImportance
    );
  }

  // Sort by timestamp (newest first) and limit
  filteredMemory = filteredMemory
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, parseInt(limit));

  res.json({
    memory: filteredMemory,
    count: sessionMemory.length,
    filteredCount: filteredMemory.length,
  });
});

app.post('/api/memory/clear', (req, res) => {
  sessionMemory = [];
  saveMemory();
  res.json({ success: true, message: 'Rina\'s memory cleared!' });
});

app.get('/api/memory/summary', (req, res) => {
  const summary = {
    totalEntries: sessionMemory.length,
    recentTopics: extractTopics(sessionMemory.slice(-10)),
    memorySize: JSON.stringify(sessionMemory).length,
    importanceDistribution: getImportanceDistribution(),
    oldestEntry: sessionMemory.length > 0 ? sessionMemory[0].timestamp : null,
    newestEntry:
      sessionMemory.length > 0
        ? sessionMemory[sessionMemory.length - 1].timestamp
        : null,
  };
  res.json({ summary });
});

function getImportanceDistribution() {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  sessionMemory.forEach((entry) => {
    distribution[entry.importance] = (distribution[entry.importance] || 0) + 1;
  });
  return distribution;
}

function extractTopics(messages) {
  const topics = new Set();
  messages.forEach((entry) => {
    const text = entry.text.toLowerCase();
    if (text.includes('code') || text.includes('programming'))
      topics.add('programming');
    if (text.includes('terminal') || text.includes('command'))
      topics.add('terminal');
    if (text.includes('system') || text.includes('cpu') || text.includes('ram'))
      topics.add('system monitoring');
    if (text.includes('theme') || text.includes('color')) topics.add('theming');
    if (text.includes('help') || text.includes('how')) topics.add('help');
    if (text.includes('voice') || text.includes('speak')) topics.add('voice');
    if (text.includes('memory') || text.includes('remember'))
      topics.add('memory');
  });
  return Array.from(topics);
}

// Payment endpoints
app.post('/api/checkout', async (req, res) => {
  try {
    const { plan, email } = req.body;

    const priceMap = {
      free: null,
      personal: process.env.STRIPE_PERSONAL_PRICE_ID,
      'early bird': process.env.STRIPE_EARLYBIRD_PRICE_ID,
    };

    const priceId = priceMap[plan.toLowerCase()];
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const session = await createCheckoutSession(priceId, email);
    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// Stripe webhook
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      handleSuccessfulPayment(session)
        .then(() => {
          console.log('Payment processed successfully');
          res.json({ received: true });
        })
        .catch((err) => {
          console.error('Payment processing failed:', err);
          res.status(500).json({ error: 'Payment processing failed' });
        });
    } else {
      res.json({ received: true });
    }
  }
);

// License validation
app.post('/api/license/validate', (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey) {
    return res.status(400).json({ error: 'License key required' });
  }

  const result = validateLicense(licenseKey);
  res.json(result);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    memory: sessionMemory.length,
    voice: !!process.env.ELEVENLABS_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    stripe: !!process.env.STRIPE_SECRET_KEY,
  });
});

// Add error handling middleware
app.use(errorHandler);

app.listen(3002, () => {
  console.log('🧜‍♀️ RinaWarp Agent backend running on port 3002');
  trackEvent('server_started', {
    port: 3002,
    environment: process.env.NODE_ENV || 'development',
  });
});
