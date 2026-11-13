/**
 * Phone OTP: 6 random digits, stored only as an HMAC in Redis.
 *   - expires after 5 minutes
 *   - 30 s resend cooldown, max 5 sends/hour per phone and 20/hour per client IP
 *   - max 5 wrong attempts, then the code is burnt
 * Never logs codes. An in-process store is used only outside production when Redis is down.
 */
import 'server-only';
import { hmac, randomDigits, safeEqualHex } from './crypto';
import { getSmsSender } from './sms';

export const OTP_TTL_SECONDS = 300;
export const OTP_COOLDOWN_SECONDS = 30;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_HOUR = 5;
export const OTP_MAX_SENDS_PER_IP_HOUR = 20;

export class OtpError extends Error {
  constructor(
    public readonly code:
      | 'OTP_COOLDOWN'
      | 'OTP_RATE_LIMITED'
      | 'OTP_EXPIRED'
      | 'OTP_INVALID'
      | 'OTP_LOCKED'
      | 'OTP_NOT_CONFIGURED'
      | 'OTP_DELIVERY_FAILED',
    public readonly retryAfterSeconds?: number,
    public readonly attemptsLeft?: number,
  ) {
    super(code);
  }
}

/** Minimal KV used by the OTP flow; Redis in normal operation. */
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
    const { requireRedis } = await import('../cache/redis');
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

async function defaultStore(): Promise<OtpStore> {
  const { getRedis } = await import('../cache/redis');
  if (await getRedis()) return new RedisOtpStore();
  if (process.env.NODE_ENV === 'production') throw new OtpError('OTP_NOT_CONFIGURED');
  globalForOtp.otpMemoryStore ??= new MemoryOtpStore();
  return globalForOtp.otpMemoryStore;
}

interface OtpRecord {
  h: string;
  attempts: number;
}

export interface OtpDependencies {
  store?: OtpStore;
  sender?: { sendOtp(phone: string, code: string, language: string): Promise<{ mode: string; devCode?: string }> };
  generate?: () => string;
}

export async function requestOtp(
  phone: string,
  clientKey: string,
  language = 'hi',
  deps: OtpDependencies = {},
): Promise<{ expiresInSeconds: number; cooldownSeconds: number; deliveryMode: string; devCode?: string }> {
  const store = deps.store ?? (await defaultStore());
  const cooldownKey = `otp:cooldown:${phone}`;
  const remaining = await store.ttl(cooldownKey);
  if (remaining > 0) throw new OtpError('OTP_COOLDOWN', remaining);

  const phoneSends = await store.incrWithTtl(`otp:sends:${phone}`, 3600);
  const ipSends = await store.incrWithTtl(`otp:sends-ip:${clientKey}`, 3600);
  if (phoneSends > OTP_MAX_SENDS_PER_HOUR || ipSends > OTP_MAX_SENDS_PER_IP_HOUR) {
    throw new OtpError('OTP_RATE_LIMITED', Math.max(await store.ttl(`otp:sends:${phone}`), 60));
  }

  const code = (deps.generate ?? (() => randomDigits(6)))();
  const record: OtpRecord = { h: hmac(`${phone}:${code}`), attempts: 0 };
  await store.set(`otp:code:${phone}`, JSON.stringify(record), OTP_TTL_SECONDS);
  await store.set(cooldownKey, '1', OTP_COOLDOWN_SECONDS);

  let delivery;
  try {
    delivery = await (deps.sender ?? getSmsSender()).sendOtp(phone, code, language);
  } catch (error) {
    await store.del(`otp:code:${phone}`);
    await store.del(cooldownKey);
    const code = (error as Error).message === 'OTP_NOT_CONFIGURED' ? 'OTP_NOT_CONFIGURED' : 'OTP_DELIVERY_FAILED';
    throw new OtpError(code);
  }
  return {
    expiresInSeconds: OTP_TTL_SECONDS,
    cooldownSeconds: OTP_COOLDOWN_SECONDS,
    deliveryMode: delivery.mode,
    devCode: process.env.NODE_ENV === 'production' ? undefined : delivery.devCode,
  };
}

export async function verifyOtp(phone: string, code: string, deps: OtpDependencies = {}): Promise<true> {
  const store = deps.store ?? (await defaultStore());
  const key = `otp:code:${phone}`;
  const raw = await store.get(key);
  if (!raw) throw new OtpError('OTP_EXPIRED');
  const record = JSON.parse(raw) as OtpRecord;
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await store.del(key);
    throw new OtpError('OTP_LOCKED');
  }
  if (!/^\d{6}$/.test(code) || !safeEqualHex(hmac(`${phone}:${code}`), record.h)) {
    record.attempts += 1;
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await store.del(key);
      throw new OtpError('OTP_LOCKED');
    }
    await store.setKeepTtl(key, JSON.stringify(record));
    throw new OtpError('OTP_INVALID', undefined, OTP_MAX_ATTEMPTS - record.attempts);
  }
  await store.del(key);
  await store.del(`otp:cooldown:${phone}`);
  return true;
}
