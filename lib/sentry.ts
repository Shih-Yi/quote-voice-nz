import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

let initialised = false;

/**
 * Initialise Sentry.  Safe to call multiple times — only runs once.
 * If NEXT_PUBLIC_SENTRY_DSN is not set, Sentry is silently disabled.
 */
export function initSentry() {
  if (initialised || !SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1, // 10% of transactions
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5, // Capture replay on 50% of errors
    beforeSend(event) {
      // Strip any PII that might leak through
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      return event;
    },
  });

  initialised = true;
}

/**
 * Capture an error with optional context.
 * No-ops gracefully if Sentry is not initialised.
 */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!SENTRY_DSN) {
    console.error("[Error]", error, context);
    return;
  }

  initSentry();
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Log a breadcrumb for debugging context.
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  if (!SENTRY_DSN) return;

  initSentry();
  Sentry.addBreadcrumb({
    message,
    data,
    level: "info",
  });
}
