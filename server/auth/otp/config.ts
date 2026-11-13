/**
 * OTP provider selection (AUTH_OTP_PROVIDER):
 *   dev            free local mode — no SMS, fixed AUTH_DEV_OTP_CODE (default 424242), localhost only,
 *                  refused in production (build, server start and every request)
 *   twilio_verify  real SMS through Twilio Verify (Twilio generates, delivers, expires and checks codes)
 * Pure module (no server-only imports) so next.config.ts / instrumentation can use the guard.
 */
export type OtpProviderId = 'dev' | 'twilio_verify';

type Env = Record<string, string | undefined>;

export function configuredOtpProvider(env: Env = process.env): OtpProviderId | null {
  const value = env.AUTH_OTP_PROVIDER?.trim();
  return value === 'dev' || value === 'twilio_verify' ? value : null;
}

export const DEV_PROVIDER_IN_PRODUCTION =
  'AUTH_OTP_PROVIDER=dev (free local OTP, no SMS) cannot be used in production. Set AUTH_OTP_PROVIDER=twilio_verify.';

/** Throws when the development provider is selected for a production build/server. */
export function assertOtpProviderAllowed(env: Env = process.env): void {
  if (env.NODE_ENV === 'production' && configuredOtpProvider(env) === 'dev') throw new Error(DEV_PROVIDER_IN_PRODUCTION);
}

/** Development code: exactly 6 digits, default 424242. Never sent to clients. */
export function devOtpCode(env: Env = process.env): string {
  const code = env.AUTH_DEV_OTP_CODE?.trim() || '424242';
  if (!/^\d{6}$/.test(code)) throw new Error('AUTH_DEV_OTP_CODE must be exactly 6 digits');
  return code;
}

/** Optional allowlist of E.164 test numbers for the development provider (comma separated). Null = any number. */
export function devOtpPhones(env: Env = process.env): Set<string> | null {
  const list = (env.AUTH_DEV_OTP_PHONES ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  return list.length ? new Set(list) : null;
}

/** True for localhost / loopback hosts (with or without a port). */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const name = host.trim().toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return name === 'localhost' || name === '127.0.0.1' || name === '::1';
}

export interface TwilioVerifyConfig {
  accountSid: string;
  authToken: string;
  serviceSid: string;
}

/** Twilio credentials (server-only env vars) or null when incomplete. */
export function twilioVerifyConfig(env: Env = process.env): TwilioVerifyConfig | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  const serviceSid = env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (!accountSid?.startsWith('AC') || !authToken || !serviceSid?.startsWith('VA')) return null;
  return { accountSid, authToken, serviceSid };
}
