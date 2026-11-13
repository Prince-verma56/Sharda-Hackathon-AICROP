export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

export class InMemoryCacheProvider implements CacheProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private store = new Map<string, { value: any, expiresAt?: number }>();

  async get<T>(key: string): Promise<T | null> {
    const record = this.store.get(key);
    if (!record) return null;
    if (record.expiresAt && record.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return record.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async invalidate(pattern: string): Promise<void> {
    // Basic prefix matching for pattern (e.g. "user:*")
    const prefix = pattern.replace('*', '');
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Redis-backed cache (JSON values). If Redis is unreachable a call degrades to the
 * in-process store so a cache outage never breaks a request; callers that need strict
 * guarantees (OTP, rate limits) use server/cache/redis directly.
 */
export class RedisCacheProvider implements CacheProvider {
  private fallback = new InMemoryCacheProvider();

  private async client() {
    const { getRedis } = await import('./redis');
    return getRedis();
  }

  async get<T>(key: string): Promise<T | null> {
    const redis = await this.client();
    if (!redis) return this.fallback.get<T>(key);
    const raw = await redis.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const redis = await this.client();
    if (!redis) return this.fallback.set(key, value, ttlSeconds);
    const payload = JSON.stringify(value);
    if (ttlSeconds) await redis.set(key, payload, { EX: ttlSeconds });
    else await redis.set(key, payload);
  }

  async delete(key: string): Promise<void> {
    const redis = await this.client();
    if (!redis) return this.fallback.delete(key);
    await redis.del(key);
  }

  async invalidate(pattern: string): Promise<void> {
    const redis = await this.client();
    if (!redis) return this.fallback.invalidate(pattern);
    for await (const keys of redis.scanIterator({ MATCH: pattern, COUNT: 200 })) {
      if (keys.length) await redis.del(keys);
    }
  }
}

export const cacheProvider: CacheProvider = process.env.REDIS_URL
  ? new RedisCacheProvider()
  : new InMemoryCacheProvider();
