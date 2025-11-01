/**
 * =====================================================
 *  RinaWarp Terminal Pro — AI Routes
 * =====================================================
 * AI query endpoints with license validation
 * Note: Full AI integration requires the desktop app
 * =====================================================
 */

import express from 'express';
import { requireValidLicense } from '../middleware/license-mw.js';
import { testLicenseBypass } from '../middleware/test-license-bypass.js';
import logger from '../utils/logger.js';

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

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('AI', 'OpenAI API key not configured');
      return res.status(503).json({
        ok: false,
        error: 'AI_NOT_CONFIGURED',
        message: 'AI features require API configuration. Full AI available in desktop app.',
        timestamp: new Date().toISOString()
      });
    }

    // Simple OpenAI integration (if key is available)
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
