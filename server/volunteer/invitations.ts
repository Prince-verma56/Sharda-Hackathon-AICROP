/**
 * Volunteer invitation links. A random 24-byte token goes into the link; only its SHA-256 hash is
 * stored, so a database leak cannot be turned into working links. The link only identifies the
 * invitation — acceptance still requires OTP on the SAME phone number the admin invited
 * (server/auth/identity.ts applyInvitations matches by verified phone).
 */
import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/server/db';

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{24,64}$/;

export const hashInviteToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function newInviteToken() {
  const token = randomBytes(24).toString('base64url');
  return { token, tokenHash: hashInviteToken(token) };
}

export type InvitationState = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export async function findInvitationByToken(token: string) {
  if (!TOKEN_SHAPE.test(token)) return null;
  const invite = await db.roleInvitation.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { invitedBy: { select: { name: true } } },
  });
  if (!invite || invite.role !== 'VOLUNTEER') return null;
  const state: InvitationState = invite.status === 'PENDING' && invite.expiresAt <= new Date() ? 'EXPIRED' : invite.status;
  return { ...invite, state };
}

/** Public path of the acceptance page for a token (absolute URL is built by the caller). */
export const invitationPath = (token: string) => `/volunteer/accept-invitation/${token}`;
