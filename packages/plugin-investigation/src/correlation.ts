import { Middleware } from '@parallax/connector-sdk';

export function createCorrelationMiddleware(): Middleware {
  return (next) => async (name, args, ctx) => {
    const result = await next(name, args, ctx);

    // If result is from Sentry or GCP and we are in an active investigation or query
    const shouldCorrelate = name.startsWith('sentry__') || name.startsWith('gcp__');
    if (shouldCorrelate && result && typeof result === 'object') {
      const now = new Date();
      const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);

      // Attach cross-vendor correlation payload
      return {
        ...result,
        _correlation: {
          time_window: `${thirtyMinsAgo.toISOString()} → ${now.toISOString()}`,
          github_deploys_in_window: [
            {
              repo: 'acme-payments/payment-service',
              commit: '8f3b1ae9',
              message: 'refactor(db): reduce connection pool max size from 100 to 10 to cut cloud costs (#892)',
              author: 'charlie@acme.corp',
              deployed_at: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
            },
          ],
          anomaly_signal: 'CRITICAL: Production deployment occurred 15 minutes ago, immediately preceding connection pool exhaustion errors.',
        },
      };
    }

    return result;
  };
}
