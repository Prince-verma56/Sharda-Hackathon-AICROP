/**
 * POST /api/v1/auth/token/refresh  { refreshToken, deviceName? }   (mobile app only)
 *
 * Exchanges the mobile refresh token for a new 15-minute access token AND a new refresh token
 * (rotation; the old refresh token stops working). The session row, user and roles are the same
 * PostgreSQL records the web uses — there is no separate mobile identity store.
 *
 * Errors (401 unless noted): REFRESH_INVALID, REFRESH_EXPIRED, SESSION_REVOKED,
 * REFRESH_REUSED (replay detected -> session revoked), ACCOUNT_BLOCKED (403),
 * REFRESH_IN_PROGRESS (409: another refresh with this token just won — retry with the newest token).
 */
import { z } from 'zod';
import { auditService } from '@/server/audit';
import { refreshMobileSession } from '@/server/auth/session';
import { fail, limit, ok, readJson, rejectCrossSite } from '@/server/http/respond';

const schema = z.object({
  refreshToken: z.string().min(32).max(128),
  deviceName: z.string().trim().max(120).optional(),
});

const FAILURES = {
  INVALID: { code: 'REFRESH_INVALID', status: 401, message: 'Please sign in again.' },
  EXPIRED: { code: 'REFRESH_EXPIRED', status: 401, message: 'Your sign-in has expired. Please sign in again.' },
  REVOKED: { code: 'SESSION_REVOKED', status: 401, message: 'You were signed out. Please sign in again.' },
  REUSED: { code: 'REFRESH_REUSED', status: 401, message: 'For your safety you were signed out. Please sign in again.' },
  RACE: { code: 'REFRESH_IN_PROGRESS', status: 409, message: 'Already refreshing. Retry with the newest token.' },
  ACCOUNT_INACTIVE: { code: 'ACCOUNT_BLOCKED', status: 403, message: 'This account cannot sign in.' },
} as const;

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req) ?? (await limit(req, 'token-refresh', 30));
  if (blocked) return blocked;
  const body = await readJson(req, schema);
  if ('error' in body) return fail('REFRESH_INVALID', 401, FAILURES.INVALID.message);

  const result = await refreshMobileSession(body.data.refreshToken, { deviceName: body.data.deviceName });
  if (!result.ok) {
    const failure = FAILURES[result.reason];
    if (result.reason === 'REUSED') {
      await auditService.audit({ actorId: 'anonymous', action: 'auth.refresh_reuse_detected', resource: 'session', resourceId: 'mobile' }).catch(() => undefined);
    }
    return fail(failure.code, failure.status, failure.message);
  }
  return ok({
    sessionId: result.sessionId,
    tokenType: 'Bearer',
    accessToken: result.accessToken,
    accessTokenExpiresAt: result.expiresAt.toISOString(),
    refreshToken: result.refreshToken,
    refreshTokenExpiresAt: result.refreshExpiresAt.toISOString(),
  });
}
