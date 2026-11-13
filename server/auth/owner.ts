/**
 * Project owners / developers (AUTH_OWNER_PHONES, comma-separated E.164 numbers, server-only).
 * After a verified OTP an owner always holds SUPER_ADMIN + FARMER + VOLUNTEER, so one phone can
 * test every workspace; the admin workspace is their default landing. Keep this list tiny and
 * empty in production unless you really mean it — it is equivalent to the bootstrap script.
 */
import 'server-only';
import type { AppRole, Prisma } from '@prisma/client';

export function ownerPhones(env: Record<string, string | undefined> = process.env): Set<string> {
  return new Set((env.AUTH_OWNER_PHONES ?? '').split(',').map((p) => p.trim()).filter((p) => /^\+[1-9]\d{7,14}$/.test(p)));
}

export function isOwnerPhone(phone: string | null | undefined): boolean {
  return Boolean(phone && ownerPhones().has(phone));
}

const OWNER_ROLES: AppRole[] = ['SUPER_ADMIN', 'FARMER', 'VOLUNTEER'];

/** Grants the owner roles and their profiles (idempotent). Returns roles that were added. */
export async function ensureOwnerAccess(tx: Prisma.TransactionClient, userId: string, language: 'hi' | 'en' = 'en'): Promise<AppRole[]> {
  const existing = new Set((await tx.userRole.findMany({ where: { userId }, select: { role: true } })).map((r) => r.role));
  const added: AppRole[] = [];
  for (const role of OWNER_ROLES) {
    if (existing.has(role)) continue;
    await tx.userRole.create({ data: { userId, role } });
    added.push(role);
  }
  await tx.adminProfile.upsert({ where: { userId }, create: { userId, adminLevel: 'ADMIN' }, update: {} });
  await tx.farmerProfile.upsert({ where: { userId }, create: { userId, language }, update: {} });
  await tx.volunteerProfile.upsert({ where: { userId }, create: { userId, verificationStatus: 'VERIFIED' }, update: { verificationStatus: 'VERIFIED' } });
  return added;
}
