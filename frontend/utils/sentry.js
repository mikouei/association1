// Sentry Configuration for Kotiz Mobile App
import * as Sentry from '@sentry/react-native';

// DSN will be loaded from environment or can be configured here
// For production, set EXPO_PUBLIC_SENTRY_DSN in your EAS secrets
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

// Initialize Sentry - call this once at app startup
export function initSentry() {
  // Only initialize if DSN is provided
  if (!SENTRY_DSN) {
    if (__DEV__) {
      console.log('[Sentry] No DSN configured, skipping initialization');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Enable in production, optionally in dev for testing
    enabled: !__DEV__,
    
    // Environment tagging
    environment: __DEV__ ? 'development' : 'production',
    
    // Basic crash reporting - keep traces disabled for free tier
    tracesSampleRate: 0,
    
    // Don't send PII by default
    sendDefaultPii: false,
    
    // App metadata
    release: 'kotiz@2.0.0',
    
    // Debug mode in dev only
    debug: __DEV__,
    
    // Attach stack traces to all messages
    attachStacktrace: true,
    
    // Before send hook - can filter or modify events
    beforeSend(event) {
      // Add custom context
      event.tags = {
        ...event.tags,
        platform: 'expo-mobile',
        appName: 'Kotiz',
      };
      return event;
    },
  });

  // Set global tags
  Sentry.setTag('platform', 'expo-mobile');
  Sentry.setTag('app', 'kotiz');

  if (__DEV__) {
    console.log('[Sentry] Initialized successfully');
  }
}

// Helper to capture exceptions with context
export function captureError(error, context = {}) {
  Sentry.captureException(error, {
    extra: context,
  });
}

// Helper to capture messages
export function captureMessage(message, level = 'info') {
  Sentry.captureMessage(message, level);
}

// Helper to set user context after login
export function setUserContext(user) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name || user.email,
    });
  } else {
    Sentry.setUser(null);
  }
}

// Helper to add breadcrumb
export function addBreadcrumb(message, category = 'navigation', data = {}) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

// Re-export Sentry for direct access if needed
export { Sentry };
