/**
 * =====================================================
 *  RinaWarp Terminal Pro — Customer Dashboard API Routes
 * =====================================================
 * Dashboard data, license management, and billing integration
 * =====================================================
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import logger from './src/utils/logger.js';

const router = express.Router();

// JWT Secret for dashboard sessions
const DASHBOARD_JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || 'dashboard-secret-change-me';

// Mock user data - in production, this would be a database
const userProfiles = new Map();
const activityLogs = new Map();

// Mock licenses (same as license-activation.js for now)
const mockLicenses = {
  'RWP-PIONEER-2025-001': {
    id: '1',
    key: 'RWP-PIONEER-2025-001',
    plan: 'Pioneer',
    maxActivations: 1,
    activations: 0,
    status: 'active',
    tierId: 'pioneer-tier',
    createdAt: '2025-01-01T00:00:00Z'
  },
  'RWP-FOUNDER-2025-001': {
    id: '2',
    key: 'RWP-FOUNDER-2025-001',
    plan: 'Founder',
    maxActivations: 1,
    activations: 0,
    status: 'active',
    tierId: 'founder-tier',
    createdAt: '2025-01-01T00:00:00Z'
  },
  'RWP-PRO-2025-001': {
    id: '3',
    key: 'RWP-PRO-2025-001',
    plan: 'Pro',
    maxActivations: 1,
    activations: 0,
    status: 'active',
    tierId: 'pro-tier',
    createdAt: '2025-01-01T00:00:00Z'
  },
  'RWP-CREATOR-2025-001': {
    id: '4',
    key: 'RWP-CREATOR-2025-001',
    plan: 'Creator',
    maxActivations: 1,
    activations: 0,
    status: 'active',
    tierId: 'creator-tier',
    createdAt: '2025-01-01T00:00:00Z'
  },
  'RWP-STARTER-2025-001': {
    id: '5',
    key: 'RWP-STARTER-2025-001',
    plan: 'Starter',
    maxActivations: 1,
    activations: 0,
    status: 'active',
    tierId: 'starter-tier',
    createdAt: '2025-01-01T00:00:00Z'
  },
  // Test licenses for monetization validation
  'RWP-TEST-FOUN-836385-RR07': {
    id: 'test-found-1',
    key: 'RWP-TEST-FOUN-836385-RR07',
    plan: 'Founder',
    maxActivations: 10,
    activations: 0,
    status: 'active',
    tierId: 'founder-tier',
    createdAt: '2025-11-14T16:47:18.000Z'
  },
  'RWP-TEST-PION-474846-WEGK': {
    id: 'test-pion-1',
    key: 'RWP-TEST-PION-474846-WEGK',
    plan: 'Pioneer',
    maxActivations: 10,
    activations: 0,
    status: 'active',
    tierId: 'pioneer-tier',
    createdAt: '2025-11-14T16:41:14.000Z'
  }
};

// GET /api/dashboard/profile - Get user dashboard profile
router.get('/profile', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: 'Authorization required'
      });
    }
    
    const token = auth.slice('Bearer '.length).trim();
    
    try {
      const decoded = jwt.verify(token, DASHBOARD_JWT_SECRET);
      const email = decoded.email;
      
      // Get license from mockLicenses
      const licenseKey = req.headers['x-license-key'];
      const license = mockLicenses[licenseKey?.toUpperCase()];
      
      if (!license || !license.ownerEmail || license.ownerEmail !== email) {
        return res.status(404).json({
          ok: false,
          error: 'User profile not found'
        });
      }
      
      // Get or create user profile
      if (!userProfiles.has(email)) {
        userProfiles.set(email, {
          email,
          name: email.split('@')[0],
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          preferences: {
            theme: 'dark',
            aiModel: 'gpt-4',
            notifications: true
          }
        });
      }
      
      const profile = userProfiles.get(email);
      profile.lastLogin = new Date().toISOString();
      
      res.json({
        ok: true,
        profile,
        license: {
          plan: license.plan,
          status: license.status,
          activations: license.activations,
          maxActivations: license.maxActivations,
          createdAt: license.createdAt
        }
      });
      
    } catch (jwtError) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid or expired token'
      });
    }
    
  } catch (error) {
    logger.error('DASHBOARD', `Profile error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to get profile'
    });
  }
});

// POST /api/dashboard/profile - Update user profile
router.post('/profile', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: 'Authorization required'
      });
    }
    
    const token = auth.slice('Bearer '.length).trim();
    
    try {
      const decoded = jwt.verify(token, DASHBOARD_JWT_SECRET);
      const email = decoded.email;
      
      const { name, preferences } = req.body;
      
      if (!userProfiles.has(email)) {
        return res.status(404).json({
          ok: false,
          error: 'Profile not found'
        });
      }
      
      const profile = userProfiles.get(email);
      
      if (name) profile.name = name;
      if (preferences) profile.preferences = { ...profile.preferences, ...preferences };
      
      userProfiles.set(email, profile);
      
      // Log activity
      logActivity(email, 'profile_updated', 'Updated profile preferences');
      
      res.json({
        ok: true,
        profile
      });
      
    } catch (jwtError) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid or expired token'
      });
    }
    
  } catch (error) {
    logger.error('DASHBOARD', `Profile update error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to update profile'
    });
  }
});

// GET /api/dashboard/activity - Get user activity log
router.get('/activity', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: 'Authorization required'
      });
    }
    
    const token = auth.slice('Bearer '.length).trim();
    
    try {
      const decoded = jwt.verify(token, DASHBOARD_JWT_SECRET);
      const email = decoded.email;
      
      const activities = activityLogs.get(email) || [
        {
          id: '1',
          type: 'login',
          description: 'Accessed dashboard',
          timestamp: new Date().toISOString(),
          details: {}
        },
        {
          id: '2',
          type: 'license_activated',
          description: 'License activated',
          timestamp: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          details: {}
        }
      ];
      
      res.json({
        ok: true,
        activities: activities.slice(0, 20) // Last 20 activities
      });
      
    } catch (jwtError) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid or expired token'
      });
    }
    
  } catch (error) {
    logger.error('DASHBOARD', `Activity log error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to get activity log'
    });
  }
});

// POST /api/dashboard/license/recover - Start license recovery process
router.post('/license/recover', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        ok: false,
        error: 'Email address required'
      });
    }
    
    // In production, this would send an email with recovery instructions
    // For now, just log it
    logger.info('DASHBOARD', `License recovery requested for: ${email}`);
    
    // Find all licenses associated with this email
    const userLicenses = [];
    for (const [key, license] of Object.entries(mockLicenses)) {
      if (license.ownerEmail === email || !license.ownerEmail) {
        userLicenses.push({
          key: key,
          plan: license.plan,
          status: license.status
        });
      }
    }
    
    if (userLicenses.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'No licenses found for this email address'
      });
    }
    
    // Log activity
    logActivity(email, 'license_recovery', 'Started license recovery process');
    
    res.json({
      ok: true,
      message: 'Recovery email sent with your license information',
      licenses: userLicenses
    });
    
  } catch (error) {
    logger.error('DASHBOARD', `License recovery error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to process recovery request'
    });
  }
});

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: 'Authorization required'
      });
    }
    
    const token = auth.slice('Bearer '.length).trim();
    
    try {
      const decoded = jwt.verify(token, DASHBOARD_JWT_SECRET);
      const email = decoded.email;
      
      // Mock statistics - in production, these would come from analytics
      const stats = {
        totalDownloads: Math.floor(Math.random() * 50) + 10,
        daysActive: Math.floor(Math.random() * 30) + 1,
        lastDownload: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        supportTickets: Math.floor(Math.random() * 5),
        accountValue: Math.floor(Math.random() * 1000) + 99
      };
      
      res.json({
        ok: true,
        stats
      });
      
    } catch (jwtError) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid or expired token'
      });
    }
    
  } catch (error) {
    logger.error('DASHBOARD', `Stats error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to get statistics'
    });
  }
});

// POST /api/dashboard/session - Create dashboard session
router.post('/session', async (req, res) => {
  try {
    const { email, licenseKey } = req.body;
    
    if (!email || !licenseKey) {
      return res.status(400).json({
        ok: false,
        error: 'Email and license key required'
      });
    }
    
    // Verify license exists and is active - Check multiple sources
    const normalizedKey = licenseKey.trim().toUpperCase();
    let license = mockLicenses[normalizedKey];
    
    // Also check global test licenses
    if (!license && global.mainLicenses) {
      license = global.mainLicenses.get(normalizedKey);
    }
    
    if (!license) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid license key'
      });
    }
    
    if (license.status !== 'active') {
      return res.status(400).json({
        ok: false,
        error: 'License is not active'
      });
    }
    
    // Associate license with email for future reference
    license.ownerEmail = email;
    
    // Create dashboard session token
    const token = jwt.sign(
      { 
        email, 
        licenseKey: normalizedKey,
        plan: license.plan 
      }, 
      DASHBOARD_JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    // Log activity
    logActivity(email, 'dashboard_login', 'Accessed customer dashboard');
    
    logger.info('DASHBOARD', `Session created for: ${email} (${license.plan})`);
    
    res.json({
      ok: true,
      token,
      user: {
        email,
        plan: license.plan,
        licenseKey: normalizedKey
      }
    });
    
  } catch (error) {
    logger.error('DASHBOARD', `Session creation error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to create session'
    });
  }
});

// GET /api/dashboard/billing/status - Get billing status
router.get('/billing/status', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: 'Authorization required'
      });
    }
    
    const token = auth.slice('Bearer '.length).trim();
    
    try {
      const decoded = jwt.verify(token, DASHBOARD_JWT_SECRET);
      const email = decoded.email;
      const plan = decoded.plan;
      
      // Mock billing data - in production, this would come from Stripe
      const billing = {
        plan: plan,
        status: plan === 'Pioneer' || plan === 'Founder' ? 'lifetime' : 'active',
        nextBilling: plan === 'Pioneer' || plan === 'Founder' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        amount: getPlanPrice(plan),
        currency: 'USD',
        paymentMethod: 'card',
        portalUrl: '/api/stripe/portal' // This would be actual Stripe portal URL
      };
      
      res.json({
        ok: true,
        billing
      });
      
    } catch (jwtError) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid or expired token'
      });
    }
    
  } catch (error) {
    logger.error('DASHBOARD', `Billing status error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to get billing status'
    });
  }
});

// Helper function to log user activity
function logActivity(email, type, description, details = {}) {
  if (!activityLogs.has(email)) {
    activityLogs.set(email, []);
  }
  
  const activities = activityLogs.get(email);
  const activity = {
    id: Date.now().toString(),
    type,
    description,
    timestamp: new Date().toISOString(),
    details
  };
  
  activities.unshift(activity); // Add to beginning
  activities.splice(50); // Keep only last 50 activities
  
  logger.info('DASHBOARD', `Activity: ${email} - ${description}`);
}

// Helper function to get plan price
function getPlanPrice(plan) {
  const prices = {
    'Community': 0,
    'Starter': 9.99,
    'Creator': 29.99,
    'Pro': 49.99,
    'Pioneer': 700,
    'Founder': 999
  };
  return prices[plan] || 0;
}

export default router;