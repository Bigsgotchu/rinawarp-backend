// backend/monitoring.js
let Sentry = null;
let ProfilingIntegration = null;
let initialized = false;

export async function initMonitoring() {
  if (initialized) return;

  try {
    if (!process.env.SENTRY_DSN) {
      console.log("🟡 Sentry disabled (no DSN)");
      return;
    }

    // Dynamic import (safe on Render)
    const sentryNode = await import('@sentry/node');
    const profiling = await import('@sentry/profiling-node');

    Sentry = sentryNode;
    ProfilingIntegration = profiling;

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
      integrations: [new ProfilingIntegration.ProfilingIntegration()],
    });

    initialized = true;
    console.log("🟢 Sentry monitoring enabled");
  } catch (err) {
    console.log("🔴 Sentry not available:", err.message);
  }
}

export function getSentry() {
  return Sentry;
}
