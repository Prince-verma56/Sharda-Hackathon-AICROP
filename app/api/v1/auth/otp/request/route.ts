/**
 * POST /api/v1/auth/otp/request  { phone, language? }
 * Sends a 6-digit login code to an Indian mobile number.
 */
import { z } from 'zod';
import { OtpError, requestOtp } from '@/server/auth/otp';
import { normalizeIndianMobile } from '@/server/auth/phone';
import { db } from '@/server/db';
import { clientKey, fail, limit, ok, readJson } from '@/server/http/respond';

const schema = z.object({
  phone: z.string().min(10).max(16),
  language: z.enum(['hi', 'en']).optional(),
});

const MESSAGES: Record<string, string> = {
  OTP_COOLDOWN: 'Please wait before requesting a new code.',
  OTP_RATE_LIMITED: 'Too many codes requested. Try again later.',
  OTP_NOT_CONFIGURED: 'SMS login is not configured on this server.',
  OTP_DELIVERY_FAILED: 'Could not send the SMS. Please try again.',
};

export async function POST(req: Request) {
  const limited = await limit(req, 'otp-request', 10);
  if (limited) return limited;
  const body = await readJson(req, schema);
  if ('error' in body) return body.error;

  const phone = normalizeIndianMobile(body.data.phone);
  if (!phone) return fail('PHONE_INVALID', 422, 'Enter a valid 10-digit Indian mobile number.');

  const existing = await db.user.findUnique({ where: { phone }, select: { kind: true, status: true } });
  if (existing && (existing.kind !== 'FARMER' || existing.status !== 'ACTIVE')) {
    return fail('ACCOUNT_UNAVAILABLE', 403, 'This number cannot sign in to the farmer app.');
  }

  try {
    const result = await requestOtp(phone, clientKey(req), body.data.language ?? 'hi');
    return ok({ phone, ...result });
  } catch (error) {
    if (error instanceof OtpError) {
      const status = error.code === 'OTP_NOT_CONFIGURED' ? 503 : error.code === 'OTP_DELIVERY_FAILED' ? 502 : 429;
      return fail(error.code, status, MESSAGES[error.code] ?? 'Could not send the code.', {
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }
    console.error('[otp] request failed', (error as Error).message);
    return fail('OTP_FAILED', 500, 'Could not send the code.');
  }
}
