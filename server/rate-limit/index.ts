import { cacheProvider } from '../cache';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export class RateLimiter {
  /**
   * Fixed-window limiter. Uses atomic Redis INCR/EXPIRE when Redis is available
   * (correct across processes); otherwise an in-process counter.
   */
  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const cacheKey = `ratelimit:${key}`;
    const now = Date.now();

    if (process.env.REDIS_URL) {
      const { getRedis } = await import('../cache/redis');
      const redis = await getRedis();
      if (redis) {
        const count = await redis.incr(cacheKey);
        if (count === 1) await redis.expire(cacheKey, windowSeconds);
        const ttl = await redis.ttl(cacheKey);
        return {
          allowed: count <= limit,
          limit,
          remaining: Math.max(0, limit - count),
          resetAt: now + Math.max(ttl, 0) * 1000,
        };
      }
    }

    let record = await cacheProvider.get<{ count: number; resetAt: number }>(cacheKey);
    if (!record || record.resetAt < now) {
      record = { count: 0, resetAt: now + windowSeconds * 1000 };
    }
    record.count += 1;
    await cacheProvider.set(cacheKey, record, windowSeconds);
    return {
      allowed: record.count <= limit,
      limit,
      remaining: Math.max(0, limit - record.count),
      resetAt: record.resetAt,
    };
  }
}

export const rateLimiter = new RateLimiter();
