// backend/middleware/license-mw.js
import fs from 'fs';
import jwt from 'jsonwebtoken';

// Helper function to get public key
const getPublicKey = () => {
  const keyPath = process.env.LICENSE_SIGNING_PUBLIC_KEY_PATH;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error('License signing public key not found');
  }
  return fs.readFileSync(keyPath, 'utf8');
};

export async function requireValidLicense(req, res, next) {
  try {
    // Skip if already authenticated by test bypass
    if (req.user && req.licenseInfo) {
      return next();
    }

    const key = req.headers['x-license-key'] || req.query.license;

    if (!key) {
      return res.status(401).json({
        ok: false,
        error: 'NO_LICENSE'
      });
    }

    // Verify the JWT token
    const decoded = jwt.verify(key, getPublicKey(), {
      algorithms: ['RS256']
    });

    // Check if license is expired
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return res.status(403).json({
        ok: false,
        error: 'LICENSE_EXPIRED'
      });
    }

    // Add license info to request
    req.licenseInfo = decoded;
    req.user = {
      id: decoded.sub,
      email: decoded.sub,
      tier: decoded.tier,
      maxUsage: decoded.maxUsage
    };

    next();
  } catch (error) {
    console.error('License verification error:', error);
    res.status(403).json({
      ok: false,
      error: 'INVALID_LICENSE'
    });
  }
}
