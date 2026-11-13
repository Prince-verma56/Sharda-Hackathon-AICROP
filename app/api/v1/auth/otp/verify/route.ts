/**
 * POST /api/v1/auth/otp/verify  { phone, code, language? }
 * Verifies the code, creates the farmer on first login and starts a farmer session.
 */
import { z } from 'zod';
import { auditService } from '@/server/audit';
import { OtpError, verifyOtp } from '@/server/auth/otp';
import { normalizeIndianMobile } from '@/server/auth/phone';
import { createSession } from '@/server/auth/session';
import { db } from '@/server/db';
import { fail, limit, ok, readJson } from '@/server/http/respond';

const schema = z.object({
  phone: z.string().min(10).max(16),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
  language: z.enum(['hi', 'en']).optional(),
});

const MESSAGES: Record<string, string> = {
  OTP_EXPIRED: 'The code has expired. Request a new one.',
  OTP_INVALID: 'Wrong code. Please check and try again.',
  OTP_LOCKED: 'Too many wrong attempts. Request a new code.',
  OTP_NOT_CONFIGURED: 'SMS login is not configured on this server.',
};

export async function POST(req: Request) {
  const limited = await limit(req, 'otp-verify', 20);
  if (limited) return limited;
  const body = await readJson(req, schema);
  if ('error' in body) return body.error;
  const phone = normalizeIndianMobile(body.data.phone);
  if (!phone) return fail('PHONE_INVALID', 422, 'Enter a valid 10-digit Indian mobile number.');

  try {
    await verifyOtp(phone, body.data.code);
  } catch (error) {
    if (error instanceof OtpError) {
      return fail(error.code, error.code === 'OTP_NOT_CONFIGURED' ? 503 : 401, MESSAGES[error.code] ?? 'Verification failed.', {
        attemptsLeft: error.attemptsLeft,
      });
    }
    console.error('[otp] verify failed', (error as Error).message);
    return fail('OTP_FAILED', 500, 'Verification failed.');
  }

  const now = new Date();
  const user = await db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { phone } });
    if (existing) {
      if (existing.kind !== 'FARMER' || existing.status !== 'ACTIVE') return null;
      return tx.user.update({ where: { id: existing.id }, data: { lastLoginAt: now, phoneVerifiedAt: existing.phoneVerifiedAt ?? now } });
    }
    return tx.user.create({
      data: {
        phone,
        phoneVerifiedAt: now,
        kind: 'FARMER',
        role: 'farmer',
        lastLoginAt: now,
        farmerProfile: { create: { language: body.data.language ?? 'hi' } },
      },
    });
  });
  if (!user) return fail('ACCOUNT_UNAVAILABLE', 403, 'This number cannot sign in to the farmer app.');

  await createSession(user.id, 'FARMER');
  await auditService.audit({ actorId: user.id, action: 'farmer.login', resource: 'user', resourceId: user.id });
  const profile = await db.farmerProfile.findUnique({ where: { userId: user.id }, select: { onboardedAt: true } });
  return ok({ next: profile?.onboardedAt ? '/farmer' : '/farmer/onboarding' });
}
