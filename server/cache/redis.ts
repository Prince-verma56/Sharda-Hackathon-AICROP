/**
 * Shared Redis client (node-redis v5). One connection per server process.
 * Returns null when REDIS_URL is not configured so callers can fall back explicitly.
 */
import 'server-only';
import { createClient, type RedisClientType } from 'redis';

const globalForRedis = globalThis as unknown as {
  redisClient?: RedisClientType;
  redisConnecting?: Promise<RedisClientType | null>;
};

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export async function getRedis(): Promise<RedisClientType | null> {
  if (!isRedisConfigured()) return null;
  if (globalForRedis.redisClient?.isReady) return globalForRedis.redisClient;
  if (!globalForRedis.redisConnecting) {
    globalForRedis.redisConnecting = (async () => {
      const client: RedisClientType = createClient({
        url: process.env.REDIS_URL,
        socket: { connectTimeout: 3000, reconnectStrategy: (retries) => Math.min(retries * 200, 3000) },
      });
      client.on('error', (error) => console.error('[redis] connection error:', (error as Error).message));
      await client.connect();
      globalForRedis.redisClient = client;
      return client;
    })().catch((error) => {
      console.error('[redis] unavailable:', (error as Error).message);
      globalForRedis.redisConnecting = undefined;
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
