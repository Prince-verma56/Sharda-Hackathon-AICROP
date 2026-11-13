/**
 * OTP providers behind one interface.
 *   dev            no SMS; compares against AUTH_DEV_OTP_CODE; localhost only; never in production
 *   twilio_verify  Twilio Verify generates, sends (SMS), expires and checks the code — CropAI never
 *                  generates or stores an OTP in this mode. One HTTP call per action, no retries
 *                  (a retry could send a second, billed SMS).
 */
import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import {
  configuredOtpProvider,
  devOtpCode,
  devOtpPhones,
  isLocalHost,
  twilioVerifyConfig,
  type OtpProviderId,
} from './config';
import { OtpError, type OtpErrorCode } from './errors';

export interface OtpContext {
  /** Host header of the request (the dev provider only answers on localhost). */
  host: string | null;
  /** SMS language. */
  locale: 'en' | 'hi';
}

export interface OtpProvider {
  readonly id: OtpProviderId;
  /** Sends (or, in dev mode, simulates) a code. Throws OtpError when the provider refuses. */
  start(phone: string, ctx: OtpContext): Promise<void>;
  /** true = approved, false = wrong code. Throws OtpError for expired / locked / provider errors. */
  check(phone: string, code: string, ctx: OtpContext): Promise<boolean>;
}

type Env = Record<string, string | undefined>;

// ---- development ---------------------------------------------------------------------------

export function createDevOtpProvider(env: Env = process.env): OtpProvider {
  function guard(phone: string, host: string | null) {
    if (env.NODE_ENV === 'production') throw new OtpError('OTP_NOT_CONFIGURED');
    if (!isLocalHost(host)) throw new OtpError('OTP_DEV_LOCALHOST_ONLY');
    const allowed = devOtpPhones(env);
    if (allowed && !allowed.has(phone)) throw new OtpError('OTP_PHONE_NOT_ALLOWED');
  }
  return {
    id: 'dev',
    async start(phone, { host }) {
      guard(phone, host);
      // Development mode: nothing is sent.
    },
    async check(phone, code, { host }) {
      guard(phone, host);
      const expected = Buffer.from(devOtpCode(env));
      const given = Buffer.from(code);
      return given.length === expected.length && timingSafeEqual(given, expected);
    },
  };
}

// ---- Twilio Verify -------------------------------------------------------------------------

/** Twilio error code -> our code. https://www.twilio.com/docs/api/errors */
const TWILIO_ERRORS: Record<number, OtpErrorCode> = {
  20003: 'OTP_NOT_CONFIGURED', // authentication failed
  20404: 'OTP_EXPIRED', // no pending verification (expired, approved or never started)
  20429: 'OTP_RATE_LIMITED',
  21211: 'OTP_NUMBER_UNSUPPORTED', // invalid 'To' number
  21408: 'OTP_COUNTRY_BLOCKED', // region not enabled
  21608: 'OTP_RECIPIENT_NOT_ALLOWED', // trial account: unverified recipient
  21610: 'OTP_DELIVERY_BLOCKED', // recipient unsubscribed (STOP)
  21614: 'OTP_NUMBER_UNSUPPORTED', // not a mobile number
  60200: 'OTP_NUMBER_UNSUPPORTED', // invalid parameter (usually the phone number)
  60202: 'OTP_LOCKED', // max check attempts reached
  60203: 'OTP_RATE_LIMITED', // max send attempts reached
  60205: 'OTP_NUMBER_UNSUPPORTED', // SMS not supported by landline
  60212: 'OTP_RATE_LIMITED', // too many concurrent requests for this number
  60223: 'OTP_NOT_CONFIGURED', // delivery channel disabled for the service
  60410: 'OTP_DELIVERY_BLOCKED', // Fraud Guard / suspected SMS pumping
  60605: 'OTP_COUNTRY_BLOCKED', // Verify geo permissions
};

interface TwilioReply {
  status?: string;
  valid?: boolean;
  code?: number;
  message?: string;
}

export function twilioErrorToOtpError(httpStatus: number, body: TwilioReply): OtpError {
  const providerCode = typeof body.code === 'number' ? body.code : undefined;
  const mapped =
    (providerCode !== undefined ? TWILIO_ERRORS[providerCode] : undefined) ??
    (httpStatus === 401 ? 'OTP_NOT_CONFIGURED' : httpStatus === 404 ? 'OTP_EXPIRED' : httpStatus === 429 ? 'OTP_RATE_LIMITED' : 'OTP_PROVIDER_ERROR');
  return new OtpError(mapped, { providerCode: providerCode ?? httpStatus });
}

export function createTwilioVerifyProvider(env: Env = process.env, fetchImpl: typeof fetch = fetch): OtpProvider {
  async function call(path: 'Verifications' | 'VerificationCheck', form: Record<string, string>) {
    const config = twilioVerifyConfig(env);
    if (!config) throw new OtpError('OTP_NOT_CONFIGURED');
    let response: Response;
    try {
      response = await fetchImpl(`https://verify.twilio.com/v2/Services/${config.serviceSid}/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(form),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new OtpError('OTP_PROVIDER_ERROR');
    }
    const body = ((await response.json().catch(() => ({}))) ?? {}) as TwilioReply;
    if (!response.ok) {
      const error = twilioErrorToOtpError(response.status, body);
      // Exact provider reason for operators; never the phone number or a code.
      console.warn(`[otp] twilio ${path} refused: http ${response.status}, twilio code ${body.code ?? 'n/a'} -> ${error.code}`);
      throw error;
    }
    return body;
  }

  return {
    id: 'twilio_verify',
    async start(phone, { locale }) {
      const reply = await call('Verifications', { To: phone, Channel: 'sms', Locale: locale });
      if (reply.status !== 'pending') throw new OtpError('OTP_PROVIDER_ERROR');
    },
    async check(phone, code) {
      const reply = await call('VerificationCheck', { To: phone, Code: code });
      // "approved" = correct code; "pending" = wrong code (verification still open).
      return reply.status === 'approved' && reply.valid !== false;
    },
  };
}

/** The configured provider, or OTP_NOT_CONFIGURED. The dev provider is refused in production. */
export function getOtpProvider(env: Env = process.env): OtpProvider {
  const id = configuredOtpProvider(env);
  if (id === 'twilio_verify') return createTwilioVerifyProvider(env);
  if (id === 'dev' && env.NODE_ENV !== 'production') return createDevOtpProvider(env);
  throw new OtpError('OTP_NOT_CONFIGURED');
}
