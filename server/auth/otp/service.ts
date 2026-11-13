/**
 * OTP orchestration (provider-independent): abuse limits + challenge state + provider.
 *   - 30 s resend cooldown per number
 *   - max 5 OTP requests / hour per number and 20 / hour per client IP (SMS-pumping protection)
 *   - max 30 code checks / 10 min per client IP; max 5 wrong codes per OTP, then a new OTP is needed
 *   - a code can only be checked after an OTP was started for that number (10-minute window)
 * Phone numbers are keyed by HMAC in Redis; OTP codes are never logged or stored by CropAI.
 */
import 'server-only';
import { hmac } from '../crypto';
import { OtpError } from './errors';
import { getOtpProvider, type OtpContext, type OtpProvider } from './providers';
import { defaultOtpStore, type OtpStore } from './store';

export const OTP_TTL_SECONDS = 600; // Twilio Verify codes are valid for 10 minutes
export const OTP_COOLDOWN_SECONDS = 30;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_STARTS_PER_PHONE_HOUR = 5;
export const OTP_MAX_STARTS_PER_IP_HOUR = 20;
export const OTP_MAX_CHECKS_PER_IP_WINDOW = 30;
const CHECK_WINDOW_SECONDS = 600;

export interface OtpDeps {
  store?: OtpStore;
  provider?: OtpProvider;
}

export interface OtpRequestContext extends OtpContext {
  /** client IP (rate limiting only, never stored with user data) */
  clientKey: string;
}

interface Challenge {
  provider: string;
  attempts: number;
}

const keys = (phone: string) => {
  const id = hmac(`otp:${phone}`);
  return { challenge: `otp:challenge:${id}`, cooldown: `otp:cooldown:${id}`, starts: `otp:starts:${id}` };
};

export interface OtpStarted {
  expiresInSeconds: number;
  resendAfterSeconds: number;
  /** "development" = no SMS was sent (dev provider); "sms" = real SMS */
  delivery: 'development' | 'sms';
}

export async function startOtp(phone: string, ctx: OtpRequestContext, deps: OtpDeps = {}): Promise<OtpStarted> {
  const provider = deps.provider ?? getOtpProvider();
  const store = deps.store ?? (await defaultOtpStore());
  const k = keys(phone);

  const wait = await store.ttl(k.cooldown);
  if (wait > 0) throw new OtpError('OTP_COOLDOWN', { retryAfterSeconds: wait });

  const phoneStarts = await store.incrWithTtl(k.starts, 3600);
  const ipStarts = await store.incrWithTtl(`otp:starts-ip:${hmac(ctx.clientKey)}`, 3600);
  if (phoneStarts > OTP_MAX_STARTS_PER_PHONE_HOUR || ipStarts > OTP_MAX_STARTS_PER_IP_HOUR) {
    throw new OtpError('OTP_RATE_LIMITED', { retryAfterSeconds: Math.max(await store.ttl(k.starts), 60) });
  }

  await provider.start(phone, ctx); // throws on refusal: no challenge, no "sent" response
  const challenge: Challenge = { provider: provider.id, attempts: 0 };
  await store.set(k.challenge, JSON.stringify(challenge), OTP_TTL_SECONDS);
  await store.set(k.cooldown, '1', OTP_COOLDOWN_SECONDS);
  return {
    expiresInSeconds: OTP_TTL_SECONDS,
    resendAfterSeconds: OTP_COOLDOWN_SECONDS,
    delivery: provider.id === 'dev' ? 'development' : 'sms',
  };
}

/** Resolves when the code is approved; otherwise throws OtpError (INVALID / EXPIRED / LOCKED / ...). */
export async function verifyOtp(phone: string, code: string, ctx: OtpRequestContext, deps: OtpDeps = {}): Promise<void> {
  const provider = deps.provider ?? getOtpProvider();
  const store = deps.store ?? (await defaultOtpStore());
  const k = keys(phone);

  const checks = await store.incrWithTtl(`otp:checks-ip:${hmac(ctx.clientKey)}`, CHECK_WINDOW_SECONDS);
  if (checks > OTP_MAX_CHECKS_PER_IP_WINDOW) throw new OtpError('OTP_RATE_LIMITED', { retryAfterSeconds: CHECK_WINDOW_SECONDS });

  const raw = await store.get(k.challenge);
  if (!raw) throw new OtpError('OTP_EXPIRED');
  const challenge = JSON.parse(raw) as Challenge;
  if (challenge.provider !== provider.id) {
    await store.del(k.challenge);
    throw new OtpError('OTP_EXPIRED');
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    await store.del(k.challenge);
    throw new OtpError('OTP_LOCKED');
  }

  let approved: boolean;
  try {
    approved = /^\d{6}$/.test(code) && (await provider.check(phone, code, ctx));
  } catch (error) {
    if (error instanceof OtpError && (error.code === 'OTP_EXPIRED' || error.code === 'OTP_LOCKED')) await store.del(k.challenge);
    throw error;
  }

  if (!approved) {
    challenge.attempts += 1;
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      await store.del(k.challenge);
      throw new OtpError('OTP_LOCKED');
    }
    await store.setKeepTtl(k.challenge, JSON.stringify(challenge));
    throw new OtpError('OTP_INVALID', { attemptsLeft: OTP_MAX_ATTEMPTS - challenge.attempts });
  }

  // Single use: the challenge and the cooldown are cleared once approved.
  await store.del(k.challenge);
  await store.del(k.cooldown);
}
