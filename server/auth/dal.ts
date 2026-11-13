/**
 * Data Access Layer for identity (session -> CropAI user, roles, status).
 * Pages, server actions, route handlers and mobile (Bearer) requests all go through here.
 * The session token comes from the HttpOnly cookie or `Authorization: Bearer`; user ids and
 * roles sent by a browser are never trusted.
 */
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AppRole, UserStatus } from '@prisma/client';
import { continueUrl, loginUrl, workspacesForRoles, type Workspace } from '@/lib/auth/redirects';
import { db } from '@/server/db';
import { can, type Permission, type StaffRoleName } from './rbac';
import { presentedToken, resolveSession } from './session';

export type { Workspace };

export type IdentityState =
  | { state: 'signed_out' }
  | { state: 'suspended'; status: Exclude<UserStatus, 'ACTIVE'> }
  | { state: 'error'; code: string }
  | { state: 'ok'; user: AppUser };

export interface AppUser {
  userId: string;
  sessionId: string;
  phone: string;
  name: string | null;
  roles: AppRole[];
  activeWorkspace: string | null;
  farmer: { preferredName: string | null; language: string; onboarded: boolean } | null;
  adminRole: StaffRoleName | null;
  volunteer: { serviceArea: string | null; verificationStatus: string; trainingStatus: string; profileComplete: boolean } | null;
}

/** Language chosen on the login page (cookie). English by default. */
export async function loginLanguage(): Promise<'hi' | 'en'> {
  try {
    return (await cookies()).get('cropai_lang')?.value === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

/** Uncached — use after changing roles in the same request (e.g. accepting invitations). */
export async function loadIdentity(): Promise<IdentityState> {
  const presented = await presentedToken();
  if (!presented) return { state: 'signed_out' };
  const session = await resolveSession(presented.token);
  if (!session) return { state: 'signed_out' };
  const userId = session.userId;
  const sessionId = session.sessionId;
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { roles: true, farmerProfile: true, adminProfile: true, volunteerProfile: true },
  });
  if (!user) return { state: 'signed_out' };
  if (user.status !== 'ACTIVE') return { state: 'suspended', status: user.status };
  if (!user.phone) return { state: 'error', code: 'NO_VERIFIED_PHONE' };
  const roles = user.roles.map((r) => r.role);
  const adminRole: StaffRoleName | null = roles.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : roles.includes('ADMIN') ? (user.adminProfile?.adminLevel ?? 'ADMIN') : null;
  return {
    state: 'ok',
    user: {
      userId: user.id,
      sessionId,
      phone: user.phone,
      name: user.name,
      roles,
      activeWorkspace: user.activeWorkspace,
      farmer: roles.includes('FARMER')
        ? { preferredName: user.farmerProfile?.preferredName ?? null, language: user.farmerProfile?.language ?? 'en', onboarded: Boolean(user.farmerProfile?.onboardedAt) }
        : null,
      adminRole,
      volunteer: roles.includes('VOLUNTEER')
        ? {
            serviceArea: user.volunteerProfile?.serviceArea ?? null,
            verificationStatus: user.volunteerProfile?.verificationStatus ?? 'PENDING',
            trainingStatus: user.volunteerProfile?.trainingStatus ?? 'NOT_STARTED',
            profileComplete: Boolean(user.volunteerProfile?.profileCompletedAt),
          }
        : null,
    },
  };
}

/** Per-request cached identity for pages, layouts, actions and route handlers. */
export const getIdentity = cache(loadIdentity);

export async function getAppUser(): Promise<AppUser | null> {
  const identity = await getIdentity();
  return identity.state === 'ok' ? identity.user : null;
}

/** Workspaces this account may open — from database roles only (a suspended volunteer has none). */
export function workspacesFor(user: AppUser): Workspace[] {
  return workspacesForRoles(user.roles, user.volunteer?.verificationStatus ?? null);
}

/** Signed out -> /login; signed in but blocked/without the role -> /auth/continue explains or routes. */
async function requireUser(role: Workspace): Promise<AppUser> {
  const identity = await getIdentity();
  if (identity.state === 'signed_out') redirect(loginUrl({ role }));
  if (identity.state !== 'ok') redirect(continueUrl({ role }));
  return identity.user;
}

// ---- farmers ----------------------------------------------------------------------------

export interface CurrentFarmer {
  userId: string;
  sessionId: string;
  phone: string;
  preferredName: string | null;
  language: string;
  onboarded: boolean;
}

function toFarmer(user: AppUser): CurrentFarmer | null {
  if (!user.farmer) return null;
  return { userId: user.userId, sessionId: user.sessionId, phone: user.phone, ...user.farmer };
}

export async function getCurrentFarmer(): Promise<CurrentFarmer | null> {
  const user = await getAppUser();
  return user ? toFarmer(user) : null;
}

export async function requireFarmer(): Promise<CurrentFarmer> {
  const farmer = toFarmer(await requireUser('farmer'));
  if (!farmer) redirect(continueUrl({ role: 'farmer' }));
  return farmer;
}

// ---- admins -----------------------------------------------------------------------------

export interface CurrentStaff {
  userId: string;
  sessionId: string;
  phone: string;
  name: string | null;
  role: StaffRoleName;
}

function toStaff(user: AppUser): CurrentStaff | null {
  return user.adminRole ? { userId: user.userId, sessionId: user.sessionId, phone: user.phone, name: user.name, role: user.adminRole } : null;
}

export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const user = await getAppUser();
  return user ? toStaff(user) : null;
}

export async function requireStaff(permission?: Permission): Promise<CurrentStaff> {
  const staff = toStaff(await requireUser('admin'));
  if (!staff) redirect(continueUrl({ role: 'admin' }));
  if (permission && !can(staff.role, permission)) redirect('/admin/forbidden');
  return staff;
}

// ---- volunteers -------------------------------------------------------------------------

export interface CurrentVolunteer {
  userId: string;
  phone: string;
  name: string | null;
  serviceArea: string | null;
  verificationStatus: string;
  trainingStatus: string;
  profileComplete: boolean;
}

export async function requireVolunteer(): Promise<CurrentVolunteer> {
  const user = await requireUser('volunteer');
  if (!user.volunteer || !workspacesFor(user).includes('volunteer')) redirect(continueUrl({ role: 'volunteer' }));
  return { userId: user.userId, phone: user.phone, name: user.name, ...user.volunteer };
}
