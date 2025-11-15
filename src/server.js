const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const Groq = require('groq-sdk');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const {
  speak,
  getRinaPersonality,
  addContextToPrompt,
  updateVoiceConfig,
  getVoiceConfig,
  getAvailableVoices,
  testVoice,
} = require('./aiVoice');
const ConversationMemory = require('./conversationMemory');
const aiProviderManager = require('./ai-providers');
const { initPostHogServer, trackLicenseEvent, trackAIUsage, trackPaymentEvent, trackServerError } = require('./posthog-server');
require('dotenv').config();

// Load AI context on startup
const CONTEXT_PATH = path.resolve('.roo/context.bundle.md');
let PROJECT_CONTEXT = '';
try {
  PROJECT_CONTEXT = fs.readFileSync(CONTEXT_PATH, 'utf8');
  console.log(`🧠 Loaded global RinaWarp context (${PROJECT_CONTEXT.split('\n').length} lines)`);
} catch (err) {
  console.warn('⚠️ AI context not found. Run `npm run docs:ai` to generate it.');
}

// Live reload context in development
if (process.env.NODE_ENV === 'development') {
  fs.watchFile(CONTEXT_PATH, () => {
    try {
      PROJECT_CONTEXT = fs.readFileSync(CONTEXT_PATH, 'utf8');
      console.log('♻️ AI context reloaded');
    } catch (err) {
      console.warn('⚠️ Failed to reload context:', err.message);
    }
  });
}

const app = express();
app.use(bodyParser.json());

// Initialize AI providers
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Initialize conversation memory
const conversationMemory = new ConversationMemory();

// Initialize PostHog analytics
initPostHogServer();

// AWS S3 configuration
AWS.config.update({ region: 'us-east-1' });
const s3 = new AWS.S3();

// AI Agent endpoint
app.post('/api/ai', async (req, res) => {
  const { prompt, provider = 'groq', enableVoice = false } = req.body;

  try {
    // System mode if asking for stats
    if (
      prompt.toLowerCase().includes('cpu') ||
      prompt.toLowerCase().includes('ram')
    ) {
      return res.json({ type: 'system', response: 'fetch_system_stats' });
    }

    // Get conversation history for context
    const conversationHistory = conversationMemory.getConversationHistory(5);
    const rinaPersonality = getRinaPersonality();
    const contextualPrompt = addContextToPrompt(
      rinaPersonality,
      conversationHistory
    );

    let reply;
    const startTime = Date.now();

    if (provider === 'groq') {
      // Use Groq API (faster, more cost-effective)
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: `[CONTEXT START]\n${PROJECT_CONTEXT}\n[CONTEXT END]\n\n${contextualPrompt}` },
          { role: 'user', content: prompt },
        ],
        model: 'llama-3.1-70b-versatile',
        temperature: 0.7,
        max_tokens: 1000,
      });
      reply =
        completion.choices[0]?.message?.content || 'No response generated';
    } else {
      // Use OpenAI API (more advanced reasoning)
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `[CONTEXT START]\n${PROJECT_CONTEXT}\n[CONTEXT END]\n\n${contextualPrompt}` },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });
      reply =
        completion.choices[0]?.message?.content || 'No response generated';
    }

    const duration = Date.now() - startTime;

    // Track AI usage analytics
    trackAIUsage(
      req.ip || 'anonymous',
      provider,
      null, // tokens not available from basic API
      true,
      duration
    );

    // Add to conversation memory
    conversationMemory.addMessage(prompt, reply, provider);

    // Generate voice if requested
    if (enableVoice && process.env.ELEVENLABS_API_KEY) {
      try {
        // Don't await - let it run in background
        speak(reply).catch((err) => console.error('Voice error:', err));
      } catch (voiceError) {
        console.error('Voice generation error:', voiceError);
      }
    }

    res.json({
      type: 'ai',
      response: reply,
      provider: provider,
      timestamp: new Date().toISOString(),
      voiceEnabled: enableVoice,
    });
  } catch (err) {
    console.error(`${provider.toUpperCase()} error:`, err);

    // Track error analytics
    trackServerError(err, {
      provider,
      endpoint: '/api/ai',
      user_id: req.ip || 'anonymous'
    });

    res.status(500).json({
      type: 'error',
      response: `${provider.toUpperCase()} service error: ${err.message}`,
      provider: provider,
    });
  }
});

// Get available AI providers
app.get('/api/providers', (req, res) => {
  const providers = [];

  if (
    process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== 'your_api_key_here'
  ) {
    providers.push({
      id: 'openai',
      name: 'OpenAI GPT-4o-mini',
      description: 'Advanced reasoning and creativity',
    });
  }

  if (
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== 'your_api_key_here'
  ) {
    providers.push({
      id: 'groq',
      name: 'Groq Llama 3.1 70B',
      description: 'Ultra-fast responses',
    });
  }

  res.json({ providers });
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

// Conversation management endpoints
app.get('/api/conversation/history', (req, res) => {
  const history = conversationMemory.getConversationHistory(20);
  res.json({ history });
});

app.post('/api/conversation/clear', (req, res) => {
  conversationMemory.startNewSession();
  res.json({ success: true, message: 'Conversation cleared' });
});

app.get('/api/conversation/summary', (req, res) => {
  const summary = conversationMemory.getContextSummary();
  res.json({ summary });
});

// Download endpoint
app.get('/download/:file', async (req, res) => {
  try {
    const file = req.params.file;
    const params = { Bucket: 'rinawarp-downloads', Key: file, Expires: 60 };
    const url = s3.getSignedUrl('getObject', params);
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

// AI Provider Management Routes
app.get('/api/ai/providers', (req, res) => {
  try {
    const providers = aiProviderManager.getAvailableProviders();
    res.json({
      type: 'providers_response',
      providers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get providers error:', error);
    res.status(500).json({
      error: 'Failed to get providers',
      message: error.message,
    });
  }
});

app.post('/api/ai/providers', (req, res) => {
  try {
    const { id, apiKey } = req.body;

    if (!id || !apiKey) {
      return res.status(400).json({
        error: 'Provider ID and API key are required',
      });
    }

    const success = aiProviderManager.addProvider(id, { apiKey });

    if (success) {
      res.json({
        type: 'provider_added',
        id,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(400).json({
        error: 'Failed to add provider',
      });
    }
  } catch (error) {
    console.error('Add provider error:', error);
    res.status(500).json({
      error: 'Failed to add provider',
      message: error.message,
    });
  }
});

app.delete('/api/ai/providers/:id', (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Provider ID is required',
      });
    }

    const success = aiProviderManager.removeProvider(id);

    if (success) {
      res.json({
        type: 'provider_removed',
        id,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(400).json({
        error: 'Failed to remove provider',
      });
    }
  } catch (error) {
    console.error('Remove provider error:', error);
    res.status(500).json({
      error: 'Failed to remove provider',
      message: error.message,
    });
  }
});

app.post('/api/ai/providers/:id/test', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Provider ID is required',
      });
    }

    const result = await aiProviderManager.testProvider(id);

    res.json({
      type: 'provider_test',
      id,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Test provider error:', error);
    res.status(500).json({
      error: 'Failed to test provider',
      message: error.message,
    });
  }
});

// Voice Management Routes
app.get('/api/voice/config', (req, res) => {
  try {
    const config = getVoiceConfig();
    res.json({
      type: 'voice_config',
      config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get voice config error:', error);
    res.status(500).json({
      error: 'Failed to get voice config',
      message: error.message,
    });
  }
});

app.put('/api/voice/config', (req, res) => {
  try {
    const newConfig = req.body;

    if (!newConfig) {
      return res.status(400).json({
        error: 'Voice config is required',
      });
    }

    updateVoiceConfig(newConfig);

    res.json({
      type: 'voice_config_updated',
      config: getVoiceConfig(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Update voice config error:', error);
    res.status(500).json({
      error: 'Failed to update voice config',
      message: error.message,
    });
  }
});

app.get('/api/voice/voices', (req, res) => {
  try {
    const voices = getAvailableVoices();
    res.json({
      type: 'available_voices',
      voices,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get voices error:', error);
    res.status(500).json({
      error: 'Failed to get voices',
      message: error.message,
    });
  }
});

app.post('/api/voice/test', async (req, res) => {
  try {
    const { voiceId, text } = req.body;

    if (!voiceId) {
      return res.status(400).json({
        error: 'Voice ID is required',
      });
    }

    const result = await testVoice(voiceId, text);

    res.json({
      type: 'voice_test',
      voiceId,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Test voice error:', error);
    res.status(500).json({
      error: 'Failed to test voice',
      message: error.message,
    });
  }
});

// Email subscription endpoint
app.post('/api/subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
      });
    }

    // Mailchimp API integration
    const mailchimpApiKey = process.env.MAILCHIMP_API_KEY;
    const mailchimpListId = process.env.MAILCHIMP_LIST_ID;
    const mailchimpServer = process.env.MAILCHIMP_SERVER || 'us1'; // e.g., us1, us2

    if (!mailchimpApiKey || !mailchimpListId) {
      console.error('Mailchimp credentials not configured');
      return res.status(500).json({
        error: 'Email service not configured',
      });
    }

    const url = `https://${mailchimpServer}.api.mailchimp.com/3.0/lists/${mailchimpListId}/members`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `apikey ${mailchimpApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        status: 'subscribed',
        merge_fields: {},
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`Email subscribed: ${email}`);
      res.json({
        success: true,
        message: 'Successfully subscribed to the newsletter',
        id: data.id,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error('Mailchimp error:', data);
      res.status(response.status).json({
        error: data.title || 'Subscription failed',
        message: data.detail || 'Please try again later',
      });
    }
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({
      error: 'Subscription failed',
      message: error.message,
    });
  }
});

app.listen(3001, () =>
  console.log('Agent backend running on https://rinawarptech.com')
);
