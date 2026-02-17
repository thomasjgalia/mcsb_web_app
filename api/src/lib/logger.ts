// ============================================================================
// Backend Logger - Environment-Based Logging
// ============================================================================
// Controls logging verbosity based on environment
// Production: Minimal logging, no sensitive data
// Development: Verbose logging for debugging
// ============================================================================

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  error: (message: string, error?: any) => {
    // Always log errors, but sanitize in production
    if (isDevelopment) {
      console.error(message, error);
    } else {
      // In production, log minimal error without stack traces or sensitive data
      console.error(`[ERROR] ${message}`);
    }
  },

  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  info: (...args: any[]) => {
    // Info logs only in development
    if (isDevelopment) {
      console.info(...args);
    }
  },

  // Production-safe logging for critical events
  audit: (message: string, metadata?: Record<string, any>) => {
    // Always log audit events, but without sensitive details in production
    if (isProduction) {
      console.log(`[AUDIT] ${message}`);
    } else {
      console.log(`[AUDIT] ${message}`, metadata);
    }
  }
};
