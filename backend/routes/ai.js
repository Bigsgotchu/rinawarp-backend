// backend/routes/ai.js
import express from 'express';
import RinaAIIntegration from '../../src/ai/rina-ai-integration.js';
import { requireValidLicense } from '../middleware/license-mw.js';
import { testLicenseBypass } from '../middleware/test-license-bypass.js';
import logger from '../utils/logger.js';

const router = express.Router();

// POST /api/ai/query — AI query with license enforcement
router.post('/query', testLicenseBypass, requireValidLicense, async (req, res) => {
  try {
    const { message, context, model } = req.body;

    if (!message) {
      logger.warn('AI', 'Query attempted without message');
      return res.status(400).json({
        ok: false,
        error: 'Message is required'
      });
    }

    logger.info('AI', `Query from ${req.user?.id || req.headers['x-user-email']}: ${message.substring(0, 50)}...`);

    const rinaAI = new RinaAIIntegration();
    await rinaAI.initializeRina();

    // Remember the prompt for emotional context
    if (rinaAI.rinaPersonality) {
      rinaAI.rinaPersonality.remember(message);
    }

    const reply = await rinaAI.rinaRespond({
      userId: req.user?.id || req.headers['x-user-email'],
      message,
      context: context || {},
      model: model || process.env.RINA_DEFAULT_MODEL
    });

    logger.info('AI', `Response mood: ${reply.mood} ${reply.emoji}`);
    logger.rina(`Responded with ${reply.mood} energy`);

    res.json({
      ok: true,
      reply: reply.message,
      mood: reply.mood,
      emoji: reply.emoji,
      tone: reply.tone,
      provider: reply.provider,
      timestamp: reply.timestamp
    });
  } catch (error) {
    logger.error('AI', `Query error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'RINA_AI_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/ai/status — Get AI system status (requires license)
router.get('/status', testLicenseBypass, requireValidLicense, async (req, res) => {
  try {
    logger.info('AI', 'Status check requested');

    const rinaAI = new RinaAIIntegration();
    await rinaAI.initializeRina();

    const status = rinaAI.getRinaStatus();

    logger.info('AI', `Status: ${JSON.stringify(status)}`);

    res.json({
      ok: true,
      status
    });
  } catch (error) {
    logger.error('AI', `Status error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to get AI status'
    });
  }
});

export default router;
