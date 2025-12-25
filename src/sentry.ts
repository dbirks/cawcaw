import * as Sentry from '@sentry/react';

if (typeof window !== 'undefined') {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 0.5,
    replaysOnErrorSampleRate: 1.0,
    release: `caw-caw@${import.meta.env.npm_package_version || '0.1.4'}`,
    beforeSend(event) {
      if (import.meta.env.MODE === 'test') {
        return null;
      }
      return event;
    },
  });
}
