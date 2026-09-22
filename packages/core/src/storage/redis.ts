import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config();
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.warn('[Redis] Connection warning (running in degraded offline mode if unready):', err.message);
});
