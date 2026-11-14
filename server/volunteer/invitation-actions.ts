'use server';

import { redirect } from 'next/navigation';
import { auditService } from '@/server/audit';
import { getAppUser } from '@/server/auth/dal';
import { refreshInvitations } from '@/server/auth/identity';
import { findInvitationByToken } from './invitations';

/**
 * Accepts a volunteer invitation for the signed-in account. Re-checks everything on the server:
 * the token, PENDING + not expired, and that the OTP-verified phone of this session is exactly the
 * invited number. The role is then added by the same single-use acceptance the login uses.
 */
export async function acceptInvitation(form: FormData) {
  const token = String(form.get('token') ?? '');
  const user = await getAppUser();
  if (!user) redirect(`/login?role=volunteer&next=/volunteer/accept-invitation/${token}`);
  const invite = await findInvitationByToken(token);
  if (!invite || invite.state !== 'PENDING' || invite.phone !== user.phone) redirect(`/volunteer/accept-invitation/${token}`);
  const added = await refreshInvitations(user.userId, user.phone);
  await auditService.audit({ actorId: user.userId, action: 'volunteer.invitation_link_accepted', resource: 'role_invitation', resourceId: invite.id, metadata: { rolesAdded: added } });
  redirect('/volunteer/profile');
}
