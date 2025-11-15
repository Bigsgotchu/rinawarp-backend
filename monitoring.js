// backend/monitoring.js
// -----------------------------------------------------
// 100% Optional Monitoring Layer
// Never fails deployments
// Safely disabled if Sentry is missing
// -----------------------------------------------------

let Sentry = null;
let ProfilingIntegration = null;
let initialized = false;

/**
 * Initialize monitoring (safe for Render)
 * Attempts to load @sentry/node dynamically.
 * If missing or DSN not set → silently disabled.
 */
export async function initMonitoring() {
  if (initialized) return;

  try {
    if (!process.env.SENTRY_DSN) {
      console.log("🟡 Sentry disabled: No DSN provided");
      return;
    }

    // Dynamic import (SAFE — bundlers & Render won't scan this)
    const sentryNode = await import("@sentry/node").catch(() => null);
    const profilingNode = await import("@sentry/profiling-node").catch(() => null);

    if (!sentryNode || !profilingNode) {
      console.log("🔴 Sentry packages not installed — Monitoring disabled");
      return;
    }

    Sentry = sentryNode;
    ProfilingIntegration = profilingNode;

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
      integrations: [new ProfilingIntegration.ProfilingIntegration()]
    });

    initialized = true;
    console.log("🟢 Sentry monitoring initialized");
  } catch (err) {
    console.log("🔴 Monitoring initialization error:", err.message);
  }
}

/**
 * Safe getter — ALWAYS returns a valid object
 */
export function getSentry() {
  return Sentry || {
    captureException: () => {},
    captureMessage: () => {},
    withScope: (fn) => fn(),
  };
}
