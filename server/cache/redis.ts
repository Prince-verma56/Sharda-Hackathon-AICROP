/**
 * Shared Redis client (node-redis v5). One connection per server process.
 * Returns null when REDIS_URL is not configured so callers can fall back explicitly.
 */
import 'server-only';
import { createClient, type RedisClientType } from 'redis';

const globalForRedis = globalThis as unknown as {
  redisClient?: RedisClientType;
  redisConnecting?: Promise<RedisClientType | null>;
  redisFailedAt?: number;
};

/** How long the first connection may take before callers get null (fall back) instead of waiting. */
const FIRST_CONNECT_DEADLINE_MS = 5000;
/** After a failed first connection, don't retry (and make every request wait) for this long. */
const FAILURE_BACKOFF_MS = 30_000;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export async function getRedis(): Promise<RedisClientType | null> {
  if (!isRedisConfigured()) return null;
  if (globalForRedis.redisClient?.isReady) return globalForRedis.redisClient;
  if (globalForRedis.redisFailedAt && Date.now() - globalForRedis.redisFailedAt < FAILURE_BACKOFF_MS) return null;
  if (!globalForRedis.redisConnecting) {
    globalForRedis.redisConnecting = (async () => {
      let everReady = false;
      const client: RedisClientType = createClient({
        url: process.env.REDIS_URL,
        socket: {
          connectTimeout: 3000,
          // Unreachable from the start (wrong/unset host in this environment): stop after 2 retries so
          // connect() rejects and callers fall back. Once connected, keep reconnecting through blips.
          reconnectStrategy: (retries) => (!everReady && retries >= 2 ? new Error('Redis unreachable') : Math.min(retries * 200, 3000)),
        },
      });
      client.on('ready', () => {
        everReady = true;
      });
      client.on('error', (error) => console.error('[redis] connection error:', (error as Error).message));
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          client.connect(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`connect timed out after ${FIRST_CONNECT_DEADLINE_MS} ms`)), FIRST_CONNECT_DEADLINE_MS);
          }),
        ]);
      } catch (error) {
        try {
          client.destroy();
        } catch {}
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
      globalForRedis.redisClient = client;
      globalForRedis.redisFailedAt = undefined;
      return client;
    })().catch((error) => {
      console.error('[redis] unavailable:', (error as Error).message);
      globalForRedis.redisConnecting = undefined;
      globalForRedis.redisFailedAt = Date.now();
      return null;
    });
  }
  return globalForRedis.redisConnecting;
}

/** Redis client or a clear error: for features (OTP, rate limits) that must not silently degrade in production. */
export async function requireRedis(): Promise<RedisClientType> {
  const client = await getRedis();
  if (!client) throw new Error('REDIS_UNAVAILABLE');
  return client;
}
