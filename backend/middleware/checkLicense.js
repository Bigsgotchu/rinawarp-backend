import Stripe from 'stripe';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// In-memory storage for free tier requests (in production, use Redis or database)
const freeRequests = new Map();

// Helper function to get daily request count for free users
function getDailyRequestCount(email) {
  const today = new Date().toDateString();
  const key = `${email}:${today}`;

  if (!freeRequests.has(key)) {
    freeRequests.set(key, 0);
  }

  return freeRequests.get(key);
}

// Helper function to increment daily request count
function incrementDailyRequestCount(email) {
  const today = new Date().toDateString();
  const key = `${email}:${today}`;

  const current = freeRequests.get(key) || 0;
  freeRequests.set(key, current + 1);

  return current + 1;
}

// Helper function to reset old entries (cleanup)
function cleanupOldEntries() {
  const today = new Date().toDateString();
  for (const key of freeRequests.keys()) {
    if (!key.endsWith(`:${today}`)) {
      freeRequests.delete(key);
    }
  }
}

export async function checkLicense(req, res, next) {
  try {
    const userEmail = req.headers['x-user-email'];
    const userTier = req.headers['x-user-tier'] || 'free';

    if (!userEmail) {
      return res.status(401).json({ error: 'Missing email header' });
    }

    // Handle free tier users
    if (userTier === 'free' || userTier === 'student') {
      const dailyLimit = userTier === 'student' ? 50 : 10; // 50 for students, 10 for basic free
      const currentCount = getDailyRequestCount(userEmail);

      if (currentCount >= dailyLimit) {
        return res.status(429).json({
          error: 'Daily request limit exceeded',
          limit: dailyLimit,
          used: currentCount,
          resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Increment the counter for this request
      incrementDailyRequestCount(userEmail);

      // Add request info to the request object for tracking
      req.requestInfo = {
        tier: userTier,
        dailyLimit,
        currentCount: currentCount + 1,
        isFreeTier: true,
      };

      // All good for free tier 👍
      return next();
    }

    // 🔐 Look up Stripe customer by email for paid tiers
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return res.status(403).json({ error: 'No license found for this user' });
    }

    const customer = customers.data[0];

    // ✅ Check if customer has an active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.status(403).json({ error: 'No active subscription found' });
    }

    // Add request info for paid users
    req.requestInfo = {
      tier: userTier,
      isFreeTier: false,
      subscriptionId: subscriptions.data[0].id,
    };

    // All good for paid users 👍
    next();
  } catch (err) {
    console.error('[License Check Error]', err);
    res
      .status(500)
      .json({ error: 'License validation failed', details: err.message });
  }
}
