/**
 * Phone-OTP authentication units (no network, no SMS): provider selection and production guard,
 * development provider, Twilio Verify provider (fetch mocked), abuse limits, error mapping.
 */
import { describe, expect, it, vi } from 'vitest';
import { assertOtpProviderAllowed, configuredOtpProvider, devOtpCode, devOtpPhones, isLocalHost, twilioVerifyConfig } from '@/server/auth/otp/config';
import { OtpError } from '@/server/auth/otp/errors';
import { createDevOtpProvider, createTwilioVerifyProvider, getOtpProvider, type OtpProvider } from '@/server/auth/otp/providers';
import { OTP_MAX_ATTEMPTS, OTP_MAX_STARTS_PER_PHONE_HOUR, startOtp, verifyOtp } from '@/server/auth/otp/service';
import { MemoryOtpStore } from '@/server/auth/otp/store';

process.env.AUTH_SECRET ??= 'test-secret-test-secret-test-secret-1234';

const local = { host: 'localhost:3000', locale: 'en' as const };
const twilioEnv = { NODE_ENV: 'production', TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'token', TWILIO_VERIFY_SERVICE_SID: 'VA123' };

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    return error instanceof OtpError ? error.code : String(error);
  }
}

describe('provider configuration', () => {
  it('reads AUTH_OTP_PROVIDER strictly', () => {
    expect(configuredOtpProvider({ AUTH_OTP_PROVIDER: 'dev' })).toBe('dev');
    expect(configuredOtpProvider({ AUTH_OTP_PROVIDER: 'twilio_verify' })).toBe('twilio_verify');
    expect(configuredOtpProvider({ AUTH_OTP_PROVIDER: 'clerk' })).toBeNull();
    expect(configuredOtpProvider({})).toBeNull();
  });

  it('refuses the development provider in production (build / server start)', () => {
    expect(() => assertOtpProviderAllowed({ NODE_ENV: 'production', AUTH_OTP_PROVIDER: 'dev' })).toThrow(/cannot be used in production/);
    expect(() => assertOtpProviderAllowed({ NODE_ENV: 'production', AUTH_OTP_PROVIDER: 'twilio_verify' })).not.toThrow();
    expect(() => assertOtpProviderAllowed({ NODE_ENV: 'development', AUTH_OTP_PROVIDER: 'dev' })).not.toThrow();
  });

  it('getOtpProvider never returns the dev provider in production', () => {
    expect(() => getOtpProvider({ NODE_ENV: 'production', AUTH_OTP_PROVIDER: 'dev' })).toThrow(OtpError);
    expect(getOtpProvider({ NODE_ENV: 'development', AUTH_OTP_PROVIDER: 'dev' }).id).toBe('dev');
    expect(getOtpProvider({ NODE_ENV: 'production', AUTH_OTP_PROVIDER: 'twilio_verify' }).id).toBe('twilio_verify');
    expect(() => getOtpProvider({ NODE_ENV: 'development' })).toThrow(OtpError);
  });

  it('dev code defaults to 424242 and must be 6 digits', () => {
    expect(devOtpCode({})).toBe('424242');
    expect(devOtpCode({ AUTH_DEV_OTP_CODE: '135790' })).toBe('135790');
    expect(() => devOtpCode({ AUTH_DEV_OTP_CODE: '12ab' })).toThrow();
  });

  it('parses the optional development test-number list and localhost hosts', () => {
    expect(devOtpPhones({})).toBeNull();
    expect([...devOtpPhones({ AUTH_DEV_OTP_PHONES: '+919800000001, +919800000002' })!]).toEqual(['+919800000001', '+919800000002']);
    expect(isLocalHost('localhost:3000')).toBe(true);
    expect(isLocalHost('127.0.0.1')).toBe(true);
    expect(isLocalHost('[::1]:3000')).toBe(true);
    expect(isLocalHost('cropai.example.com')).toBe(false);
    expect(isLocalHost('localhost.evil.com')).toBe(false);
    expect(isLocalHost(null)).toBe(false);
  });

  it('requires complete Twilio credentials (AC… / VA…)', () => {
    expect(twilioVerifyConfig(twilioEnv)).toEqual({ accountSid: 'AC123', authToken: 'token', serviceSid: 'VA123' });
    expect(twilioVerifyConfig({ ...twilioEnv, TWILIO_VERIFY_SERVICE_SID: 'BU123' })).toBeNull();
    expect(twilioVerifyConfig({ ...twilioEnv, TWILIO_AUTH_TOKEN: '' })).toBeNull();
  });
});

describe('development provider', () => {
  const provider = createDevOtpProvider({ NODE_ENV: 'development', AUTH_DEV_OTP_CODE: '424242' });

  it('accepts only the configured code, only on localhost', async () => {
    await expect(provider.start('+919876543210', local)).resolves.toBeUndefined();
    expect(await provider.check('+919876543210', '424242', local)).toBe(true);
    expect(await provider.check('+919876543210', '111111', local)).toBe(false);
    expect(await codeOf(provider.start('+919876543210', { host: 'cropai.example.com', locale: 'en' }))).toBe('OTP_DEV_LOCALHOST_ONLY');
  });

  it('is refused in production and honours the test-number allowlist', async () => {
    const prod = createDevOtpProvider({ NODE_ENV: 'production' });
    expect(await codeOf(prod.start('+919876543210', local))).toBe('OTP_NOT_CONFIGURED');
    const listed = createDevOtpProvider({ NODE_ENV: 'development', AUTH_DEV_OTP_PHONES: '+919800000001' });
    expect(await codeOf(listed.start('+919876543210', local))).toBe('OTP_PHONE_NOT_ALLOWED');
    await expect(listed.start('+919800000001', local)).resolves.toBeUndefined();
  });
});

describe('Twilio Verify provider (mocked HTTP, no SMS)', () => {
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('starts an SMS verification with Basic auth, To, Channel and Locale', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => reply(201, { status: 'pending' }));
    await createTwilioVerifyProvider(twilioEnv, fetchMock as unknown as typeof fetch).start('+919876543210', { host: null, locale: 'hi' });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retries
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://verify.twilio.com/v2/Services/VA123/Verifications');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('AC123:token').toString('base64')}`);
    expect(Object.fromEntries(new URLSearchParams(init.body as URLSearchParams))).toEqual({ To: '+919876543210', Channel: 'sms', Locale: 'hi' });
  });

  it('checks codes: approved -> true, pending (wrong code) -> false', async () => {
    const approved = createTwilioVerifyProvider(twilioEnv, (async () => reply(200, { status: 'approved', valid: true })) as unknown as typeof fetch);
    expect(await approved.check('+919876543210', '123456', local)).toBe(true);
    const wrong = createTwilioVerifyProvider(twilioEnv, (async () => reply(200, { status: 'pending', valid: false })) as unknown as typeof fetch);
    expect(await wrong.check('+919876543210', '000000', local)).toBe(false);
  });

  it('maps Twilio refusals to exact, user-explainable errors', async () => {
    const cases: [number, object, string][] = [
      [400, { code: 21608, message: 'unverified' }, 'OTP_RECIPIENT_NOT_ALLOWED'],
      [403, { code: 60605, message: 'geo permissions' }, 'OTP_COUNTRY_BLOCKED'],
      [400, { code: 60200, message: 'invalid parameter' }, 'OTP_NUMBER_UNSUPPORTED'],
      [429, { code: 60203, message: 'max send attempts' }, 'OTP_RATE_LIMITED'],
      [404, { code: 20404, message: 'not found' }, 'OTP_EXPIRED'],
      [429, { code: 60202, message: 'max check attempts' }, 'OTP_LOCKED'],
      [401, { code: 20003, message: 'auth' }, 'OTP_NOT_CONFIGURED'],
      [500, {}, 'OTP_PROVIDER_ERROR'],
    ];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const [status, body, expected] of cases) {
      const provider = createTwilioVerifyProvider(twilioEnv, (async () => reply(status, body)) as unknown as typeof fetch);
      expect(await codeOf(provider.start('+919876543210', local))).toBe(expected);
    }
    warn.mockRestore();
  });

  it('reports the provider code and never retries on network failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const provider = createTwilioVerifyProvider(twilioEnv, (async () => reply(400, { code: 21608 })) as unknown as typeof fetch);
    await provider.start('+919876543210', local).catch((error: OtpError) => expect(error.details.providerCode).toBe(21608));
    warn.mockRestore();
    const failing = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await codeOf(createTwilioVerifyProvider(twilioEnv, failing as unknown as typeof fetch).start('+919876543210', local))).toBe('OTP_PROVIDER_ERROR');
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it('is not configured without credentials (and makes no request)', async () => {
    const fetchMock = vi.fn();
    expect(await codeOf(createTwilioVerifyProvider({}, fetchMock as unknown as typeof fetch).start('+919876543210', local))).toBe('OTP_NOT_CONFIGURED');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('OTP service limits', () => {
  function fakeProvider(code = '424242'): OtpProvider & { starts: number } {
    return {
      id: 'dev',
      starts: 0,
      async start() {
        this.starts += 1;
      },
      async check(_phone, given) {
        return given === code;
      },
    };
  }
  const ctx = (ip = '10.0.0.1') => ({ clientKey: ip, host: 'localhost', locale: 'en' as const });

  it('enforces the resend cooldown', async () => {
    const store = new MemoryOtpStore();
    const provider = fakeProvider();
    await startOtp('+919000000001', ctx(), { store, provider });
    expect(await codeOf(startOtp('+919000000001', ctx(), { store, provider }))).toBe('OTP_COOLDOWN');
    expect(provider.starts).toBe(1);
  });

  it('caps OTP requests per number per hour', async () => {
    let now = Date.now();
    const store = new MemoryOtpStore(() => now);
    const provider = fakeProvider();
    for (let i = 0; i < OTP_MAX_STARTS_PER_PHONE_HOUR; i += 1) {
      await startOtp('+919000000002', ctx(`10.0.1.${i}`), { store, provider });
      now += 31_000; // after the cooldown
    }
    expect(await codeOf(startOtp('+919000000002', ctx('10.0.2.1'), { store, provider }))).toBe('OTP_RATE_LIMITED');
  });

  it('caps OTP requests per client IP (SMS pumping protection)', async () => {
    const store = new MemoryOtpStore();
    const provider = fakeProvider();
    for (let i = 0; i < 20; i += 1) await startOtp(`+9190000101${String(i).padStart(2, '0')}`, ctx('10.9.9.9'), { store, provider });
    expect(await codeOf(startOtp('+919000010199', ctx('10.9.9.9'), { store, provider }))).toBe('OTP_RATE_LIMITED');
  });

  it('requires a started OTP, counts wrong codes and locks after the maximum', async () => {
    const store = new MemoryOtpStore();
    const provider = fakeProvider();
    expect(await codeOf(verifyOtp('+919000000003', '424242', ctx(), { store, provider }))).toBe('OTP_EXPIRED');
    await startOtp('+919000000003', ctx(), { store, provider });
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i += 1) {
      await verifyOtp('+919000000003', '000000', ctx(), { store, provider }).catch((error: OtpError) => {
        expect(error.code).toBe('OTP_INVALID');
        expect(error.details.attemptsLeft).toBe(OTP_MAX_ATTEMPTS - i);
      });
    }
    expect(await codeOf(verifyOtp('+919000000003', '000000', ctx(), { store, provider }))).toBe('OTP_LOCKED');
    expect(await codeOf(verifyOtp('+919000000003', '424242', ctx(), { store, provider }))).toBe('OTP_EXPIRED');
  });

  it('approves once: a code cannot be reused', async () => {
    const store = new MemoryOtpStore();
    const provider = fakeProvider();
    await startOtp('+919000000004', ctx(), { store, provider });
    expect(await codeOf(verifyOtp('+919000000004', '424242', ctx(), { store, provider }))).toBe('resolved');
    expect(await codeOf(verifyOtp('+919000000004', '424242', ctx(), { store, provider }))).toBe('OTP_EXPIRED');
  });

  it('does not create a challenge when the provider refuses to send', async () => {
    const store = new MemoryOtpStore();
    const refusing: OtpProvider = {
      id: 'twilio_verify',
      async start() {
        throw new OtpError('OTP_RECIPIENT_NOT_ALLOWED', { providerCode: 21608 });
      },
      async check() {
        return true;
      },
    };
    expect(await codeOf(startOtp('+919000000005', ctx(), { store, provider: refusing }))).toBe('OTP_RECIPIENT_NOT_ALLOWED');
    expect(await codeOf(verifyOtp('+919000000005', '123456', ctx(), { store, provider: refusing }))).toBe('OTP_EXPIRED');
  });
});
