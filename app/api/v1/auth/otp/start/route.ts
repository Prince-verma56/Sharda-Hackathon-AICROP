/**
 * POST /api/v1/auth/otp/start  { phoneNumber, requestedRole?, language? }
 *
 * Starts phone verification with the configured provider (AUTH_OTP_PROVIDER):
 *   dev            no SMS (localhost only, never in production)
 *   twilio_verify  real SMS — Twilio generates, delivers and expires the code
 * The response is identical for existing and new numbers (no account enumeration) and never
 * contains a code. Limits: cooldown, per-number and per-IP caps (see server/auth/otp/service.ts).
 */
import { z } from 'zod';
import { LANGUAGE, PHONE_NUMBER, REQUESTED_ROLE, otpFailure } from '@/server/auth/api';
import { startOtp } from '@/server/auth/otp/service';
import { normalizePhoneE164 } from '@/server/auth/phone';
import { clientKey, fail, limit, ok, readJson, rejectCrossSite } from '@/server/http/respond';

const schema = z.object({ phoneNumber: PHONE_NUMBER, requestedRole: REQUESTED_ROLE, language: LANGUAGE });

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req) ?? (await limit(req, 'otp-start', 10));
  if (blocked) return blocked;
  const body = await readJson(req, schema);
  if ('error' in body) return body.error;

  const phone = normalizePhoneE164(body.data.phoneNumber);
  if (!phone) return fail('PHONE_INVALID', 422, 'Enter a valid mobile number (10 digits for India, or + country code).');

  try {
    const started = await startOtp(phone, { clientKey: clientKey(req), host: req.headers.get('host'), locale: body.data.language });
    return ok({ status: 'pending', ...started });
  } catch (error) {
    return otpFailure(error);
  }
}
