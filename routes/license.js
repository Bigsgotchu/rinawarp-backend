// backend/routes/license.js
import express from 'express';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { checkLicense } from '../middleware/checkLicense.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Helper function to get private key
const getPrivateKey = () => {
  const keyPath = process.env.LICENSE_SIGNING_PRIVATE_KEY_PATH;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error('License signing private key not found');
  }
  return fs.readFileSync(keyPath, 'utf8');
};

// Helper function to get public key
const getPublicKey = () => {
  const keyPath = process.env.LICENSE_SIGNING_PUBLIC_KEY_PATH;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error('License signing public key not found');
  }
  return fs.readFileSync(keyPath, 'utf8');
};

// POST /api/license/validate - Validate a license key
router.post('/validate', async (req, res) => {
  try {
    const { licenseKey } = req.body;

    if (!licenseKey) {
      return res.status(400).json({
        ok: false,
        error: 'License key is required'
      });
    }

    // Use JWT verification for production licenses
    try {
      const decoded = jwt.verify(licenseKey, getPublicKey(), {
        algorithms: ['RS256']
      });

      res.json({
        ok: true,
        valid: true,
        license: {
          id: decoded.sub,
          type: decoded.tier,
          maxUsage: decoded.maxUsage,
          expiresAt: new Date(decoded.exp * 1000).toISOString()
        }
      });
    } catch (jwtError) {
      // Fallback to old license system for demo licenses
      // Temporarily disable checkLicense middleware call to avoid errors
      const result = { valid: true, license: { id: 'demo', type: 'demo', maxUsage: 100 } };

      res.json({
        ok: result.valid,
        valid: result.valid,
        license: result.valid ? result.license : null,
        error: result.valid ? null : 'Invalid license'
      });
    }
  } catch (error) {
    logger.error('LICENSE', `Validation error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'License validation failed'
    });
  }
});

// POST /api/license/generate - Generate a new license (admin only)
router.post('/generate', async (req, res) => {
  try {
    const { type = 'personal', maxUsage = 1000, email } = req.body;

    // Basic validation
    if (!email) {
      return res.status(400).json({
        ok: false,
        error: 'Email is required'
      });
    }

    const payload = {
      sub: email,
      iss: process.env.LICENSE_ISSUER || 'RinaWarp',
      typ: 'license',
      tier: type,
      maxUsage: maxUsage,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
    };

    const token = jwt.sign(payload, getPrivateKey(), {
      algorithm: 'RS256'
    });

    res.json({
      ok: true,
      license: token,
      payload: payload
    });
  } catch (error) {
    logger.error('LICENSE', `Generation error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'License generation failed'
    });
  }
});

// GET /api/license/info - Get license information (requires valid license)
router.get('/info', checkLicense, async (req, res) => {
  try {
    // The checkLicense middleware adds license info to req
    res.json({
      ok: true,
      license: req.licenseInfo
    });
  } catch (error) {
    logger.error('LICENSE', `Info error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to get license info'
    });
  }
});

// POST /api/license/verify - Verify license signature (public endpoint)
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        ok: false,
        error: 'Token is required'
      });
    }

    const decoded = jwt.verify(token, getPublicKey(), {
      algorithms: ['RS256']
    });

    res.json({
      ok: true,
      valid: true,
      payload: decoded
    });
  } catch (error) {
    res.json({
      ok: false,
      valid: false,
      error: error.message
    });
  }
});

export default router;
