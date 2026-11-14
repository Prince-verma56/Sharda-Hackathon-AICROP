/**
 * POST /api/v1/auth/logout  { everywhere?: boolean, refreshToken?: string }
 * Revokes the session(s) and clears the cookie. The mobile app also sends its refresh token so the
 * session is revoked even when the access token has already expired.
 */
import { z } from 'zod';
import { auditService } from '@/server/audit';
import { getAppUser } from '@/server/auth/dal';
import { destroyCurrentSession, revokeAllSessions, revokeByRefreshToken } from '@/server/auth/session';
import { ok, readJson, rejectCrossSite } from '@/server/http/respond';

const schema = z.object({ everywhere: z.boolean().default(false), refreshToken: z.string().min(32).max(128).optional() });

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = await readJson(req, schema);
  const everywhere = 'data' in body ? body.data.everywhere : false;
  const refreshToken = 'data' in body ? body.data.refreshToken : undefined;
  const user = await getAppUser();
  if (user && everywhere) await revokeAllSessions(user.userId);
  await destroyCurrentSession();
  if (refreshToken) await revokeByRefreshToken(refreshToken);
  if (user) await auditService.audit({ actorId: user.userId, action: everywhere ? 'auth.logout_everywhere' : 'auth.logout', resource: 'user', resourceId: user.userId });
  return ok({ next: '/login' });
}
