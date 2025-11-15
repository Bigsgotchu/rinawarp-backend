// Terminal Pro License Activation Routes
import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Mock database - in production, use Prisma
const mockLicenses = {
  'RWP-PIONEER-2025-001': {
    id: '1',
    key: 'RWP-PIONEER-2025-001',
    plan: 'Pioneer',
    maxActivations: 1,
    activations: 0,
    status: 'active',
    tierId: 'pioneer-tier'
  },
  'RWP-FOUNDER-2025-001': {
    id: '2',
    key: 'RWP-FOUNDER-2025-001',
    plan: 'Founder',
    maxActivations: 1,
    activations: 0,
    status: 'active',
    tierId: 'founder-tier'
  },
  'RWP-PRO-2025-001': {
    id: '3',
    key: 'RWP-PRO-2025-001',
    plan: 'Pro',
    maxActivations: 1,
    activations: 0,
    status: 'active',
    tierId: 'pro-tier'
  },
  'RWP-CREATOR-2025-001': {
    id: '4',
    key: 'RWP-CREATOR-2025-001',
    plan: 'Creator',
    maxActivations: 1,
    activations: 0,
    status: 'active',
    tierId: 'creator-tier'
  },
  'RWP-STARTER-2025-001': {
    id: '5',
    key: 'RWP-STARTER-2025-001',
    plan: 'Starter',
    maxActivations: 1,
    activations: 0,
    status: 'active',
    tierId: 'starter-tier'
  }
};

const LICENSE_JWT_SECRET = process.env.LICENSE_JWT_SECRET || 'dev-secret-change-terminal-pro';

// POST /api/license/activate
router.post('/activate', async (req, res) => {
  try {
    const { email, licenseKey } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({ 
        ok: false, 
        error: 'License key is required.' 
      });
    }

    // Normalize license key (remove spaces, uppercase)
    const normalizedKey = licenseKey.trim().toUpperCase();
    
    const license = mockLicenses[normalizedKey];
    
    if (!license) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid license key.' 
      });
    }
    
    if (license.status !== 'active') {
      return res.status(400).json({ 
        ok: false, 
        error: 'License is not active.' 
      });
    }
    
    if (license.activations >= license.maxActivations) {
      return res.status(400).json({ 
        ok: false, 
        error: 'License has reached its activation limit.' 
      });
    }

    // Simulate activation
    license.activations += 1;
    license.ownerEmail = email || license.ownerEmail;

    const payload = {
      licenseId: license.id,
      key: license.key,
      plan: license.plan
    };

    const token = jwt.sign(payload, LICENSE_JWT_SECRET, {
      expiresIn: '365d',
    });

    return res.json({
      ok: true,
      token,
      license: {
        plan: license.plan,
        activations: license.activations,
        maxActivations: license.maxActivations,
        status: license.status,
      },
    });
  } catch (err) {
    console.error('License activation error:', err);
    return res.status(400).json({
      ok: false,
      error: err.message || 'Unable to activate license.',
    });
  }
});

// GET /api/license/status
router.get('/status', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.json({ ok: false, active: false });
    }
    
    const token = auth.slice('Bearer '.length).trim();

    try {
      const decoded = jwt.verify(token, LICENSE_JWT_SECRET);
      
      // Check if license still exists and is active
      const license = mockLicenses[decoded.key];
      if (!license || license.status !== 'active') {
        return res.json({ ok: false, active: false });
      }

      return res.json({
        ok: true,
        active: true,
        license: {
          plan: license.plan,
          status: license.status,
          activations: license.activations,
          maxActivations: license.maxActivations,
        },
      });
    } catch (jwtError) {
      return res.json({ ok: false, active: false });
    }
  } catch (err) {
    console.error('License status error:', err);
    return res.json({ ok: false, active: false });
  }
});

// POST /api/license/validate (alias for activate)
router.post('/validate', async (req, res) => {
  // Same as activate - for compatibility
  return router.handle(req, res, () => {});
});

export default router;