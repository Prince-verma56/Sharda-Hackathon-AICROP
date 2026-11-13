'use server';

import { redirect } from 'next/navigation';
import { auditService } from '@/server/audit';
import { getAppUser } from './dal';
import { destroyCurrentSession, revokeAllSessions } from './session';

/** Logs out this browser: revokes the session in the database and clears the cookie. */
export async function signOut() {
  const user = await getAppUser();
  await destroyCurrentSession();
  if (user) await auditService.audit({ actorId: user.userId, action: 'auth.logout', resource: 'user', resourceId: user.userId });
  redirect('/login');
}

/** Ends every active session of the signed-in user (all phones and browsers). */
export async function signOutEverywhere() {
  const user = await getAppUser();
  if (user) {
    const revoked = await revokeAllSessions(user.userId);
    await auditService.audit({ actorId: user.userId, action: 'auth.logout_everywhere', resource: 'user', resourceId: user.userId, metadata: { revoked } });
  }
  await destroyCurrentSession();
  redirect('/login');
}
