/**
 * PostHog Server-Side Analytics for RinaWarp Terminal Pro
 * Tracks backend events, license usage, and server metrics
 */

import PostHog from 'posthog-node';

// Initialize PostHog client
let posthogClient = null;

export function initPostHogServer() {
  const posthogKey = process.env.POSTHOG_KEY;
  const posthogHost = process.env.POSTHOG_HOST || 'https://app.posthog.com';

  if (!posthogKey) {
    console.warn('PostHog server key not configured. Server analytics disabled.');
    return false;
  }

  try {
    posthogClient = new PostHog(posthogKey, {
      host: posthogHost,
      flushAt: 1, // Flush immediately for real-time insights
      flushInterval: 1000, // Flush every second
    });

    console.log('📊 PostHog server analytics initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize PostHog server:', error);
    return false;
  }
}

// Track license events
export function trackLicenseEvent(userId, event, licenseType, properties = {}) {
  if (!posthogClient) return;

  posthogClient.capture({
    distinctId: userId,
    event: `license_${event}`,
    properties: {
      license_type: licenseType,
      ...properties,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    },
  });
}

// Track AI provider usage
export function trackAIUsage(userId, provider, model, tokens = null, success = true, duration = null) {
  if (!posthogClient) return;

  posthogClient.capture({
    distinctId: userId,
    event: 'ai_request',
    properties: {
      provider,
      model,
      tokens_used: tokens,
      success,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    },
  });
}

// Track payment events
export function trackPaymentEvent(userId, event, amount = null, currency = 'usd', properties = {}) {
  if (!posthogClient) return;

  posthogClient.capture({
    distinctId: userId,
    event: `payment_${event}`,
    properties: {
      amount,
      currency,
      ...properties,
      timestamp: new Date().toISOString(),
    },
  });
}

// Track server performance
export function trackServerMetric(metric, value, properties = {}) {
  if (!posthogClient) return;

  posthogClient.capture({
    distinctId: 'server',
    event: 'server_metric',
    properties: {
      metric,
      value,
      ...properties,
      timestamp: new Date().toISOString(),
    },
  });
}

// Track error events (complement to Sentry)
export function trackServerError(error, context = {}) {
  if (!posthogClient) return;

  posthogClient.capture({
    distinctId: 'server',
    event: 'server_error',
    properties: {
      error_message: error.message,
      error_stack: error.stack,
      ...context,
      timestamp: new Date().toISOString(),
    },
  });
}

// Track user engagement
export function trackEngagement(userId, event, properties = {}) {
  if (!posthogClient) return;

  posthogClient.capture({
    distinctId: userId,
    event: `engagement_${event}`,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
    },
  });
}

// Graceful shutdown
export function shutdownPostHog() {
  if (posthogClient) {
    posthogClient.shutdown();
    console.log('📊 PostHog server analytics shut down');
  }
}

// Export client for advanced usage
export { posthogClient as posthog };
export default posthogClient;