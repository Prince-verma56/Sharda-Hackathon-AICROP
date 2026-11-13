/** POST /api/v1/auth/logout  { everywhere?: boolean } — revokes the session(s) and clears the cookie. */
import { z } from 'zod';
import { auditService } from '@/server/audit';
import { getAppUser } from '@/server/auth/dal';
import { destroyCurrentSession, revokeAllSessions } from '@/server/auth/session';
import { ok, readJson, rejectCrossSite } from '@/server/http/respond';

const schema = z.object({ everywhere: z.boolean().default(false) });

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = await readJson(req, schema);
  const everywhere = 'data' in body ? body.data.everywhere : false;
  const user = await getAppUser();
  if (user && everywhere) await revokeAllSessions(user.userId);
  await destroyCurrentSession();
  if (user) await auditService.audit({ actorId: user.userId, action: everywhere ? 'auth.logout_everywhere' : 'auth.logout', resource: 'user', resourceId: user.userId });
  return ok({ next: '/login' });
}
