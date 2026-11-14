/**
 * An unreachable REDIS_URL must not hang requests: the first connection gives up quickly, callers
 * get null (rate limiter / session cache fall back), and later calls skip Redis during a backoff.
 * Regression: node-redis with a numeric reconnectStrategy retried forever, so every route behind
 * the rate limiter waited until the platform timeout (seen on the Vercel deployment).
 */
import { afterEach, describe, expect, it } from 'vitest';

const g = globalThis as unknown as { redisClient?: unknown; redisConnecting?: unknown; redisFailedAt?: number };
const original = process.env.REDIS_URL;

function reset() {
  g.redisClient = undefined;
  g.redisConnecting = undefined;
  g.redisFailedAt = undefined;
}

describe('getRedis with an unreachable server', () => {
  afterEach(() => {
    reset();
    if (original === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original;
  });

  it('returns null quickly when the port refuses connections, then backs off without waiting', async () => {
    reset();
    process.env.REDIS_URL = 'redis://127.0.0.1:1';
    const { getRedis } = await import('@/server/cache/redis');
    const started = Date.now();
    expect(await getRedis()).toBeNull();
    expect(Date.now() - started).toBeLessThan(6000);
    const again = Date.now();
    expect(await getRedis()).toBeNull();
    expect(Date.now() - again).toBeLessThan(50); // inside the backoff window: no new attempt
  }, 15_000);

  it('returns null within the first-connect deadline when the host never answers', async () => {
    reset();
    process.env.REDIS_URL = 'redis://10.255.255.1:6379'; // non-routable: connection attempts time out
    const { getRedis } = await import('@/server/cache/redis');
    const started = Date.now();
    expect(await getRedis()).toBeNull();
    expect(Date.now() - started).toBeLessThan(7000);
  }, 20_000);

  it('the rate limiter falls back to the in-process counter instead of hanging', async () => {
    reset();
    process.env.REDIS_URL = 'redis://127.0.0.1:1';
    const { rateLimiter } = await import('@/server/rate-limit');
    const started = Date.now();
    const result = await rateLimiter.check(`test:${Date.now()}`, 5, 60);
    expect(result.allowed).toBe(true);
    expect(Date.now() - started).toBeLessThan(6000);
  }, 15_000);
});
