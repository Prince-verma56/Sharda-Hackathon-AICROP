/**
 * POST /api/v1/auth/otp/verify  { phoneNumber, code, requestedRole?, language?, client? }
 *
 * 1. The configured provider must APPROVE the code (Twilio Verify or the local dev provider).
 * 2. Roles are resolved from PostgreSQL (server/auth/identity.ts) — the requested role is only a
 *    request: farmers may self-register; volunteers/admins need an invitation or bootstrap.
 * 3. Only then is a session created (rotated): HttpOnly cookie for the web, or — with
 *    `client: "mobile"` — a Bearer token in the response body for the Flutter app.
 */
import { z } from 'zod';
import { resolveDestination, workspacesForRoles } from '@/lib/auth/redirects';
import { auditService } from '@/server/audit';
import { DENIAL_MESSAGES, LANGUAGE, PHONE_NUMBER, REQUESTED_ROLE, otpFailure, workspaceForRole } from '@/server/auth/api';
import { completePhoneLogin } from '@/server/auth/identity';
import { verifyOtp } from '@/server/auth/otp/service';
import { maskPhone, normalizePhoneE164 } from '@/server/auth/phone';
import { createSession } from '@/server/auth/session';
import { db } from '@/server/db';
import { clientKey, fail, limit, ok, readJson, rejectCrossSite } from '@/server/http/respond';

const schema = z.object({
  phoneNumber: PHONE_NUMBER,
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit OTP.'),
  requestedRole: REQUESTED_ROLE,
  language: LANGUAGE,
  client: z.enum(['web', 'mobile']).default('web'),
});

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req) ?? (await limit(req, 'otp-verify', 20));
  if (blocked) return blocked;
  const body = await readJson(req, schema);
  if ('error' in body) return body.error;

  const phone = normalizePhoneE164(body.data.phoneNumber);
  if (!phone) return fail('PHONE_INVALID', 422, 'Enter a valid mobile number.');

  try {
    await verifyOtp(phone, body.data.code, { clientKey: clientKey(req), host: req.headers.get('host'), locale: body.data.language });
  } catch (error) {
    return otpFailure(error);
  }

  const requested = workspaceForRole(body.data.requestedRole);
  const login = await completePhoneLogin(phone, requested, { language: body.data.language });
  if (!login.ok) {
    await auditService.audit({ actorId: 'anonymous', action: 'auth.login_denied', resource: 'phone', resourceId: maskPhone(phone), metadata: { reason: login.reason, requested } });
    return fail(login.reason, 403, DENIAL_MESSAGES[login.reason]);
  }

  const session = await createSession(login.userId, login.roles, body.data.client);
  const user = await db.user.findUnique({ where: { id: login.userId }, include: { volunteerProfile: { select: { verificationStatus: true } } } });
  const workspaces = workspacesForRoles(login.roles, user?.volunteerProfile?.verificationStatus ?? null);
  const destination = resolveDestination(workspaces, requested, null);

  return ok({
    userId: login.userId,
    roles: login.roles,
    workspaces,
    destination,
    ...(body.data.client === 'mobile' ? { token: session.token, expiresAt: session.expiresAt.toISOString() } : {}),
  });
}
