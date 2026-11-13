/**
 * Short-lived OTP state (challenge, cooldown, counters). Redis in normal operation; an in-process
 * store is used only outside production when Redis is not running.
 */
import 'server-only';
import { OtpError } from './errors';

export interface OtpStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  setKeepTtl(key: string, value: string): Promise<void>;
  ttl(key: string): Promise<number>;
  incrWithTtl(key: string, ttlSeconds: number): Promise<number>;
  del(key: string): Promise<void>;
}

class RedisOtpStore implements OtpStore {
  private async redis() {
    const { requireRedis } = await import('@/server/cache/redis');
    return requireRedis();
  }
  async get(key: string) {
    return (await this.redis()).get(key);
  }
  async set(key: string, value: string, ttlSeconds: number) {
    await (await this.redis()).set(key, value, { EX: ttlSeconds });
  }
  async setKeepTtl(key: string, value: string) {
    await (await this.redis()).set(key, value, { KEEPTTL: true });
  }
  async ttl(key: string) {
    return (await this.redis()).ttl(key);
  }
  async incrWithTtl(key: string, ttlSeconds: number) {
    const redis = await this.redis();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, ttlSeconds);
    return count;
  }
  async del(key: string) {
    await (await this.redis()).del(key);
  }
}

export class MemoryOtpStore implements OtpStore {
  private data = new Map<string, { value: string; expiresAt: number }>();
  constructor(private now: () => number = Date.now) {}
  private live(key: string) {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.data.delete(key);
      return null;
    }
    return entry;
  }
  async get(key: string) {
    return this.live(key)?.value ?? null;
  }
  async set(key: string, value: string, ttlSeconds: number) {
    this.data.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }
  async setKeepTtl(key: string, value: string) {
    const entry = this.live(key);
    if (entry) entry.value = value;
  }
  async ttl(key: string) {
    const entry = this.live(key);
    return entry ? Math.ceil((entry.expiresAt - this.now()) / 1000) : -2;
  }
  async incrWithTtl(key: string, ttlSeconds: number) {
    const entry = this.live(key);
    const next = (entry ? Number(entry.value) : 0) + 1;
    this.data.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? this.now() + ttlSeconds * 1000 });
    return next;
  }
  async del(key: string) {
    this.data.delete(key);
  }
}

const globalForOtp = globalThis as unknown as { otpMemoryStore?: MemoryOtpStore };

export async function defaultOtpStore(): Promise<OtpStore> {
  const { getRedis } = await import('@/server/cache/redis');
  if (await getRedis()) return new RedisOtpStore();
  if (process.env.NODE_ENV === 'production') throw new OtpError('OTP_NOT_CONFIGURED');
  globalForOtp.otpMemoryStore ??= new MemoryOtpStore();
  return globalForOtp.otpMemoryStore;
}
