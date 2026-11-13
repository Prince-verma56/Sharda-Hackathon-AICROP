/**
 * Data Access Layer for identity. Pages, server actions and route handlers call these —
 * never trust client-supplied user IDs.
 */
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { can, type Permission, type StaffRoleName } from './rbac';
import { readSession } from './session';

export interface CurrentFarmer {
  userId: string;
  sessionId: string;
  phone: string;
  preferredName: string | null;
  language: string;
  onboarded: boolean;
}

export const getCurrentFarmer = cache(async (): Promise<CurrentFarmer | null> => {
  const session = await readSession('FARMER');
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { phone: true, farmerProfile: { select: { preferredName: true, language: true, onboardedAt: true } } },
  });
  if (!user?.phone) return null;
  return {
    userId: session.userId,
    sessionId: session.sessionId,
    phone: user.phone,
    preferredName: user.farmerProfile?.preferredName ?? null,
    language: user.farmerProfile?.language ?? 'hi',
    onboarded: Boolean(user.farmerProfile?.onboardedAt),
  };
});

/** For farmer pages: redirects to login when signed out. */
export async function requireFarmer(): Promise<CurrentFarmer> {
  const farmer = await getCurrentFarmer();
  if (!farmer) redirect('/farmer/login');
  return farmer;
}

export interface CurrentStaff {
  userId: string;
  sessionId: string;
  email: string;
  name: string | null;
  role: StaffRoleName;
  mfaEnabled: boolean;
  mfaVerified: boolean;
}

export const getStaffSession = cache(async (): Promise<CurrentStaff | null> => {
  const session = await readSession('STAFF');
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, name: true, staffProfile: { select: { role: true, mfaEnabledAt: true } } },
  });
  if (!user?.email || !user.staffProfile) return null;
  return {
    userId: session.userId,
    sessionId: session.sessionId,
    email: user.email,
    name: user.name,
    role: user.staffProfile.role,
    mfaEnabled: Boolean(user.staffProfile.mfaEnabledAt),
    mfaVerified: session.mfaVerified,
  };
});

/** Fully authenticated staff (password + second factor). */
export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const staff = await getStaffSession();
  return staff && staff.mfaVerified ? staff : null;
}

/** For admin pages/actions: redirects when signed out, to /admin/forbidden when the role lacks the permission. */
export async function requireStaff(permission?: Permission): Promise<CurrentStaff> {
  const staff = await getStaffSession();
  if (!staff) redirect('/admin/login');
  if (!staff.mfaVerified) redirect(staff.mfaEnabled ? '/admin/login/mfa' : '/admin/login/mfa-setup');
  if (permission && !can(staff.role, permission)) redirect('/admin/forbidden');
  return staff;
}
