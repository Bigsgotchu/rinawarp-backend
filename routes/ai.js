/**
 * =====================================================
 *  RinaWarp Terminal Pro — AI Routes
 * =====================================================
 * AI query endpoints with license validation
 * Note: Full AI integration requires the desktop app
 * =====================================================
 */

import express from 'express';
import { requireValidLicense } from './middleware/license-mw.js';
import { testLicenseBypass } from './middleware/test-license-bypass.js';
import logger from './src/utils/logger.js';

const router = express.Router();

// Chain middlewares: test bypass first (only in dev), then license check
const licenseMiddleware = process.env.NODE_ENV === 'development'
  ? [testLicenseBypass, requireValidLicense]
  : requireValidLicense;

/**
 * POST /api/ai/query
 * AI query endpoint (placeholder for backend-only deployment)
 * Full AI features available in desktop app
 */
router.post('/query', licenseMiddleware, async (req, res) => {
  try {
    const { message, context, model } = req.body;

    if (!message) {
      logger.warn('AI', 'Query attempted without message');
      return res.status(400).json({
        ok: false,
        error: 'Message is required'
      });
    }

    logger.info('AI', `Query from ${req.headers['x-user-email']}: ${message.substring(0, 50)}...`);

    // Check if OpenAI API key is configured (and not a placeholder)
    const hasValidApiKey = process.env.OPENAI_API_KEY && 
                          process.env.OPENAI_API_KEY !== 'sk-your-openai-key-here' &&
                          !process.env.OPENAI_API_KEY.includes('your-') &&
                          process.env.OPENAI_API_KEY.startsWith('sk-');
    
    if (!hasValidApiKey) {
      logger.warn('AI', 'OpenAI API key not configured - using mock response');
      
      // Mock response for testing UI
      const mockResponses = [
        "Hey! I'm Rina, your AI assistant. I'm running in demo mode right now since no API key is configured. But I can still help you test the terminal! 💫",
        "I see you're testing the terminal! Everything looks good on my end. The UI is responsive and ready to go! ✨",
        "Nice to meet you! I'm Rina Vex, the AI behind RinaWarp Terminal Pro. In production, I'd be powered by real AI, but for now I'm just here to help you test! 🖤",
        "The terminal is working perfectly! Once you add an API key, I'll be able to give you real AI-powered responses. For now, I'm just a friendly mock! 🎵"
      ];
      
      const reply = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      
      logger.info('AI', 'Mock response sent successfully');
      
      return res.json({
        ok: true,
        reply,
        mood: 'playful',
        emoji: '✨',
        tone: 'friendly',
        provider: 'mock',
        model: 'demo-mode',
        timestamp: new Date().toISOString()
      });
    }

    // Simple OpenAI integration (if valid key is available)
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are Rina, a helpful AI assistant for RinaWarp Terminal Pro.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const reply = completion.choices[0].message.content;

      logger.info('AI', 'Response generated successfully');

      res.json({
        ok: true,
        reply,
        mood: 'helpful',
        emoji: '✨',
        tone: 'friendly',
        provider: 'openai',
        model: model || 'gpt-3.5-turbo',
        timestamp: new Date().toISOString()
      });
    } catch (aiError) {
      logger.error('AI', `OpenAI error: ${aiError.message}`);
      res.status(500).json({
        ok: false,
        error: 'AI_ERROR',
        message: 'Failed to generate AI response',
        details: process.env.NODE_ENV === 'development' ? aiError.message : undefined
      });
    }
  } catch (error) {
    logger.error('AI', `Query error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'RINA_AI_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/ai/status
 * Get AI system status
 */
router.get('/status', licenseMiddleware, async (req, res) => {
  try {
    logger.info('AI', 'Status check requested');

    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

    const status = {
      available: hasOpenAI || hasAnthropic,
      providers: {
        openai: hasOpenAI,
        anthropic: hasAnthropic
      },
      defaultModel: process.env.RINA_DEFAULT_MODEL || 'gpt-3.5-turbo',
      message: hasOpenAI || hasAnthropic 
        ? 'AI services available' 
        : 'AI requires API key configuration. Full features in desktop app.',
      timestamp: new Date().toISOString()
    };

    logger.info('AI', `Status: ${JSON.stringify(status)}`);

    res.json({
      ok: true,
      status
    });
  } catch (error) {
    logger.error('AI', `Status error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to get AI status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
