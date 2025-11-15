import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Initialize Sentry for backend monitoring with full configuration
function initSentry() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.GIT_COMMIT || 'local-dev',
      
      // Performance Monitoring - 100% sampling for development
      tracesSampleRate: 1.0,
      
      // Profiling - CPU and latency profiling
      profilesSampleRate: 1.0,
      
      integrations: [
        nodeProfilingIntegration(),
      ],
      
      // Filter sensitive data
      beforeSend(event) {
        // Remove sensitive headers
        if (event.request) {
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.Authorization;
            delete event.request.headers.Cookie;
          }
        }
        return event;
      },
    });
    console.log('🔍 Sentry monitoring initialized');
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Release: ${process.env.GIT_COMMIT || 'local-dev'}`);
    console.log('   Traces: 100% | Profiling: 100%');
  } else {
    console.log('⚠️ Sentry DSN not configured - monitoring disabled');
  }
}

// Express middleware helpers
const sentryMiddleware = {
  // Request handler - must be first middleware
  requestHandler: Sentry.Handlers.requestHandler(),
  
  // Tracing handler - for performance monitoring
  tracingHandler: Sentry.Handlers.tracingHandler(),
  
  // Error handler - must be before other error handlers
  errorHandler: Sentry.Handlers.errorHandler(),
};

// Error tracking middleware
function errorHandler(err, req, res, next) {
  console.error('Backend error:', err);

  // Capture error with Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  res.status(500).json({
    error: 'Internal server error',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Something went wrong',
  });
}

// Performance monitoring
function trackPerformance(operation, fn) {
  return async (...args) => {
    const start = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - start;

      if (process.env.SENTRY_DSN) {
        Sentry.addBreadcrumb({
          message: `Operation: ${operation}`,
          level: 'info',
          data: { duration },
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      if (process.env.SENTRY_DSN) {
        Sentry.captureException(error, {
          tags: { operation },
          extra: { duration },
        });
      }

      throw error;
    }
  };
}

// Analytics tracking
function trackEvent(event, properties = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message: `Event: ${event}`,
      level: 'info',
      data: properties,
    });
  }

  // Log to console for development
  console.log(`📊 Analytics: ${event}`, properties);
}

export { 
  initSentry, 
  errorHandler, 
  trackPerformance, 
  trackEvent,
  sentryMiddleware,
  Sentry 
};
