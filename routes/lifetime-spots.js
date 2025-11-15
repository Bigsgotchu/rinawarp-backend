import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/license/lifetime-spots - Get lifetime spots info from database
router.get('/lifetime-spots', async (req, res) => {
  try {
    // Query lifetime plans with their licenses from database
    const lifetimePlans = await prisma.terminalPlan.findMany({
      where: { isLifetime: true, isActive: true },
      include: { licenses: true },
    });

    const totalAllowed = lifetimePlans.reduce(
      (sum, plan) => sum + (plan.maxLifetime ?? 0),
      0
    );

    const used = lifetimePlans.reduce(
      (sum, plan) => sum + plan.licenses.length,
      0
    );

    const remaining = Math.max(totalAllowed - used, 0);
    const total = totalAllowed;

    // Build breakdown by plan
    const breakdown = lifetimePlans.map(plan => ({
      code: plan.code,
      name: plan.name,
      total: plan.maxLifetime ?? 0,
      used: plan.licenses.length,
      remaining: Math.max((plan.maxLifetime ?? 0) - plan.licenses.length, 0)
    }));

    // Calculate urgency based on remaining spots
    let urgency = 'low';
    if (remaining <= 50) urgency = 'high';
    else if (remaining <= 100) urgency = 'medium';

    res.json({
      ok: true,
      remaining,
      total,
      data: {
        total_spots: total,
        remaining_spots: remaining,
        used_spots: used,
        urgency,
        pioneer_remaining: breakdown.find(b => b.code === 'PIONEER')?.remaining || 0,
        founder_remaining: breakdown.find(b => b.code === 'FOUNDER')?.remaining || 0,
        pioneer_total: breakdown.find(b => b.code === 'PIONEER')?.total || 0,
        founder_total: breakdown.find(b => b.code === 'FOUNDER')?.total || 0,
        pioneer_used: breakdown.find(b => b.code === 'PIONEER')?.used || 0,
        founder_used: breakdown.find(b => b.code === 'FOUNDER')?.used || 0,
        breakdown
      }
    });
  } catch (error) {
    console.error('Error fetching lifetime spots:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch lifetime spots'
    });
  }
});

export default router;