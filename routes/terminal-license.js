// backend/routes/terminal-license.js
import express from 'express';
// Import the Prisma client - will need to be generated
import { PrismaClient } from '@prisma/client';

const router = express.Router();

// Initialize Prisma client
const prisma = new PrismaClient();

// POST /api/license/activate
router.post('/activate', async (req, res) => {
  try {
    const { email, licenseKey } = req.body;

    if (!email || !licenseKey) {
      return res.status(400).json({ ok: false, error: 'Missing email or licenseKey' });
    }

    // Look up license
    const license = await prisma.terminalLicense.findUnique({
      where: { licenseKey },
      include: { plan: true },
    });

    if (!license) {
      return res.status(404).json({ ok: false, error: 'License not found' });
    }

    if (license.status !== 'ACTIVE') {
      return res.status(400).json({ ok: false, error: `License is ${license.status}` });
    }

    // Optional: update email on first activation
    let updated = license;
    if (license.email !== email) {
      updated = await prisma.terminalLicense.update({
        where: { id: license.id },
        data: { email },
        include: { plan: true },
      });
    }

    // Compute remaining lifetime spots (shared 500 total across lifetime plans)
    const lifetimePlans = await prisma.terminalPlan.findMany({
      where: { isLifetime: true, isActive: true },
      include: { licenses: true },
    });

    const totalAllowed = lifetimePlans.reduce(
      (sum, p) => sum + (p.maxLifetime ?? 0),
      0
    );

    const used = lifetimePlans.reduce(
      (sum, p) => sum + p.licenses.length,
      0
    );

    const remainingLifetime = Math.max(totalAllowed - used, 0);

    return res.json({
      ok: true,
      licenseKey: updated.licenseKey,
      email: updated.email,
      plan: {
        code: updated.plan.code,
        name: updated.plan.name,
        billingType: updated.plan.billingType,
        isLifetime: updated.plan.isLifetime,
      },
      remainingLifetimeSpots: remainingLifetime,
    });
  } catch (err) {
    console.error('License activation error', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// GET /api/license/lifetime-spots
router.get('/lifetime-spots', async (_req, res) => {
  try {
    const lifetimePlans = await prisma.terminalPlan.findMany({
      where: { isLifetime: true, isActive: true },
      include: { licenses: true },
    });

    const totalAllowed = lifetimePlans.reduce(
      (sum, p) => sum + (p.maxLifetime ?? 0),
      0
    );

    const used = lifetimePlans.reduce(
      (sum, p) => sum + p.licenses.length,
      0
    );

    const remaining = Math.max(totalAllowed - used, 0);

    return res.json({
      ok: true,
      remaining,
      total: totalAllowed,
      data: {
        total_spots: totalAllowed,
        remaining_spots: remaining,
        used_spots: used,
        urgency: remaining <= 50 ? 'high' : remaining <= 100 ? 'medium' : 'low',
        breakdown: lifetimePlans.map(plan => ({
          code: plan.code,
          name: plan.name,
          total: plan.maxLifetime ?? 0,
          used: plan.licenses.length,
          remaining: Math.max((plan.maxLifetime ?? 0) - plan.licenses.length, 0)
        }))
      }
    });
  } catch (err) {
    console.error('lifetime-spots error', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/license/generate
router.post('/generate', async (req, res) => {
  try {
    const { email, planCode } = req.body;

    if (!email || !planCode) {
      return res.status(400).json({ ok: false, error: 'Missing email or planCode' });
    }

    // Find the plan
    const plan = await prisma.terminalPlan.findUnique({
      where: { code: planCode },
    });

    if (!plan) {
      return res.status(404).json({ ok: false, error: 'Plan not found' });
    }

    // Generate license key (simple implementation)
    const licenseKey = `RW-${planCode}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create license
    const license = await prisma.terminalLicense.create({
      data: {
        licenseKey,
        email,
        planId: plan.id,
        status: 'ACTIVE',
        metadata: {
          generated_at: new Date().toISOString(),
          source: 'admin_generated'
        }
      },
      include: { plan: true },
    });

    return res.json({
      ok: true,
      license: {
        licenseKey: license.licenseKey,
        email: license.email,
        plan: {
          code: license.plan.code,
          name: license.plan.name,
          billingType: license.plan.billingType,
        }
      }
    });
  } catch (err) {
    console.error('License generation error', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// GET /api/license/validate/:licenseKey
router.get('/validate/:licenseKey', async (req, res) => {
  try {
    const { licenseKey } = req.params;

    const license = await prisma.terminalLicense.findUnique({
      where: { licenseKey },
      include: { plan: true },
    });

    if (!license) {
      return res.status(404).json({ ok: false, error: 'License not found' });
    }

    if (license.status !== 'ACTIVE') {
      return res.status(400).json({ ok: false, error: `License is ${license.status}` });
    }

    // Check if license has expired
    if (license.expiresAt && new Date() > license.expiresAt) {
      return res.status(400).json({ ok: false, error: 'License has expired' });
    }

    return res.json({
      ok: true,
      license: {
        licenseKey: license.licenseKey,
        email: license.email,
        plan: {
          code: license.plan.code,
          name: license.plan.name,
          billingType: license.plan.billingType,
          isLifetime: license.plan.isLifetime,
        },
        status: license.status,
        activatedAt: license.activatedAt,
        expiresAt: license.expiresAt,
      }
    });
  } catch (err) {
    console.error('License validation error', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;