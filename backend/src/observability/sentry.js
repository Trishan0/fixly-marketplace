'use strict';

// Error reporting to Sentry. Only active when SENTRY_DSN is set (and never in
// tests). Route handlers log unexpected failures with console.error before
// returning a 500, so capturing console errors reports them without touching
// every handler. Request bodies, cookies and user details are not sent.

let Sentry = null;

function initSentry() {
  if (Sentry || !process.env.SENTRY_DSN || process.env.NODE_ENV === 'test') return null;
  Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) delete event.request.headers.authorization;
      }
      return event;
    },
  });
  return Sentry;
}

function captureException(error, context) {
  if (Sentry) Sentry.captureException(error, context ? { extra: context } : undefined);
}

module.exports = { captureException, initSentry };
