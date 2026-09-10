import { Middleware } from './compose.js';
import { redis } from '../storage/redis.js';
import { createHash } from 'node:crypto';

function computeCacheKey(teamId: string, toolName: string, args: Record<string, any>): string {
  const normalized = JSON.stringify(args, Object.keys(args).sort());
  const hash = createHash('sha256').update(`${teamId}:${toolName}:${normalized}`).digest('hex');
  return `parallax:cache:${teamId}:${toolName}:${hash.slice(0, 16)}`;
}

export function createSharedCacheMiddleware(): Middleware {
  return (next) => async (name, args, ctx) => {
    // Only cache read/search queries, never mutation/session commands
    const isCacheable = name.includes('search') || name.includes('list') || name.includes('get');
    if (!isCacheable) {
      return await next(name, args, ctx);
    }

    const cacheKey = computeCacheKey(ctx.teamId, name, args);

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...parsed,
          _cache: {
            hit: true,
            cached_at: parsed._cache?.cached_at || new Date().toISOString(),
            served_by: 'parallax-redis-shared-cache',
          },
        };
      }
    } catch (e) {
      // Degrade gracefully on cache failure
    }

    const result = await next(name, args, ctx);

    try {
      const ttlSeconds = 60; // 1 minute default TTL for active investigation caches
      const toCache = {
        ...result,
        _cache: {
          hit: false,
          cached_at: new Date().toISOString(),
        },
      };
      await redis.set(cacheKey, JSON.stringify(toCache), 'EX', ttlSeconds);
    } catch (e) {
      // Ignore cache write error
    }

    return result;
  };
}
