/**
 * Verified phone -> CropAI account + roles. Runs only AFTER the OTP provider approved the code.
 * The database is the only source of permissions; the login tab is a request, never a grant.
 *
 *   Farmer tab     existing account -> sign in; new number -> account + FARMER + farmer profile
 *   Volunteer tab  VOLUNTEER only through a valid invitation for this exact number
 *   Admin tab      ADMIN / SUPER_ADMIN only through bootstrap (scripts/bootstrap-admin.ts) or an
 *                  invitation created by a SUPER_ADMIN — never created by signing in
 * Unknown numbers on the Volunteer/Admin tab without an invitation get NO account and NO session.
 * SUSPENDED / PENDING / DISABLED accounts are refused even with a correct OTP.
 */
import 'server-only';
import type { AppRole, Prisma, UserStatus } from '@prisma/client';
import type { Workspace } from '@/lib/auth/redirects';
import { auditService } from '@/server/audit';
import { db } from '@/server/db';
import { ensureOwnerAccess, isOwnerPhone } from './owner';

/** Applies pending, unexpired invitations for this phone inside a transaction. Returns roles added. */
export async function applyInvitations(tx: Prisma.TransactionClient, userId: string, phone: string): Promise<AppRole[]> {
  const now = new Date();
  await tx.roleInvitation.updateMany({ where: { phone, status: 'PENDING', expiresAt: { lte: now } }, data: { status: 'EXPIRED' } });
  const invitations = await tx.roleInvitation.findMany({ where: { phone, status: 'PENDING', expiresAt: { gt: now } } });
  const added: AppRole[] = [];
  for (const invite of invitations) {
    if (invite.role !== 'VOLUNTEER' && invite.role !== 'ADMIN') continue; // FARMER/SUPER_ADMIN are never invited
    await tx.userRole.upsert({
      where: { userId_role: { userId, role: invite.role } },
      create: { userId, role: invite.role, assignedById: invite.invitedById },
      update: {},
    });
    if (invite.role === 'VOLUNTEER') {
      await tx.volunteerProfile.upsert({ where: { userId }, create: { userId, serviceArea: invite.serviceArea }, update: {} });
    } else {
      await tx.adminProfile.upsert({ where: { userId }, create: { userId, adminLevel: invite.adminLevel ?? 'ADMIN' }, update: { adminLevel: invite.adminLevel ?? 'ADMIN' } });
    }
    await tx.roleInvitation.update({ where: { id: invite.id }, data: { status: 'ACCEPTED', acceptedAt: now, acceptedUserId: userId } });
    added.push(invite.role);
  }
  return added;
}

export type LoginDenial = 'ACCOUNT_SUSPENDED' | 'ACCOUNT_PENDING' | 'ACCOUNT_DISABLED' | 'VOLUNTEER_NOT_AUTHORISED' | 'ADMIN_NOT_AUTHORISED';

export type LoginOutcome =
  | { ok: true; userId: string; roles: AppRole[]; created: boolean; rolesAdded: AppRole[] }
  | { ok: false; reason: LoginDenial };

const STATUS_DENIAL: Record<Exclude<UserStatus, 'ACTIVE'>, LoginDenial> = {
  SUSPENDED: 'ACCOUNT_SUSPENDED',
  PENDING: 'ACCOUNT_PENDING',
  DISABLED: 'ACCOUNT_DISABLED',
};

/**
 * Resolves the account for a phone number that was JUST verified by the OTP provider.
 * Never call this with a phone number that has not passed OTP verification.
 */
export async function completePhoneLogin(phone: string, requested: Workspace, options: { language?: 'hi' | 'en' } = {}): Promise<LoginOutcome> {
  const now = new Date();
  const outcome = await db.$transaction(async (tx): Promise<LoginOutcome> => {
    let user = await tx.user.findUnique({ where: { phone }, include: { roles: true } });
    if (user && user.status !== 'ACTIVE') return { ok: false, reason: STATUS_DENIAL[user.status] };

    const created = !user;
    const owner = isOwnerPhone(phone);
    if (!user) {
      const invited = await tx.roleInvitation.count({ where: { phone, status: 'PENDING', expiresAt: { gt: now } } });
      // Public self-registration exists only for farmers; staff need an invitation first (owners excepted).
      if (requested !== 'farmer' && invited === 0 && !owner) {
        return { ok: false, reason: requested === 'admin' ? 'ADMIN_NOT_AUTHORISED' : 'VOLUNTEER_NOT_AUTHORISED' };
      }
      user = await tx.user.create({ data: { phone, phoneVerifiedAt: now, lastLoginAt: now, role: 'user' }, include: { roles: true } });
    }

    const rolesAdded = await applyInvitations(tx, user.id, phone);
    if (owner) rolesAdded.push(...(await ensureOwnerAccess(tx, user.id, options.language ?? 'en')));
    const roleCount = user.roles.length + rolesAdded.length;
    const hasFarmer = user.roles.some((r) => r.role === 'FARMER') || rolesAdded.includes('FARMER');
    // FARMER (public role): a new number on the Farmer tab, or an account that has no role at all.
    if (!hasFarmer && ((created && requested === 'farmer') || roleCount === 0)) {
      await tx.userRole.create({ data: { userId: user.id, role: 'FARMER' } });
      await tx.farmerProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, language: options.language ?? 'en' }, update: {} });
      rolesAdded.push('FARMER');
    }

    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now, phoneVerifiedAt: user.phoneVerifiedAt ?? now } });
    const roles = (await tx.userRole.findMany({ where: { userId: user.id }, select: { role: true } })).map((r) => r.role);
    return { ok: true, userId: user.id, roles, created, rolesAdded };
  });

  if (outcome.ok) {
    await auditService.audit({
      actorId: outcome.userId,
      action: outcome.created ? 'auth.account_created' : 'auth.login',
      resource: 'user',
      resourceId: outcome.userId,
      metadata: { requested, rolesAdded: outcome.rolesAdded },
    });
  }
  return outcome;
}

/** Accepts invitations created after the account existed (called on /auth/continue). */
export async function refreshInvitations(userId: string, phone: string | null) {
  if (!phone) return [];
  const added = await db.$transaction((tx) => applyInvitations(tx, userId, phone));
  if (added.length) await auditService.audit({ actorId: userId, action: 'identity.invitation_accepted', resource: 'user', resourceId: userId, metadata: { rolesAdded: added } });
  return added;
}
