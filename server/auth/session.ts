/**
 * Database sessions. The cookie carries a random token; the DB stores only its SHA-256.
 * Farmers and staff use separate cookies so one can never be replayed as the other.
 */
import 'server-only';
import { cookies, headers } from 'next/headers';
import type { UserKind } from '@prisma/client';
import { db } from '@/server/db';
import { randomToken, sha256 } from './crypto';

export const FARMER_COOKIE = 'cropai_farmer';
export const STAFF_COOKIE = 'cropai_staff';

const FARMER_TTL_DAYS = 30;
const STAFF_TTL_HOURS = 12;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function cookieNameFor(kind: UserKind) {
  return kind === 'FARMER' ? FARMER_COOKIE : STAFF_COOKIE;
}

function ttlMs(kind: UserKind) {
  return kind === 'FARMER' ? FARMER_TTL_DAYS * 86_400_000 : STAFF_TTL_HOURS * 3_600_000;
}

export async function createSession(userId: string, kind: UserKind, options: { mfaVerified?: boolean } = {}) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + ttlMs(kind));
  const userAgent = (await headers()).get('user-agent')?.slice(0, 255) ?? null;
  const session = await db.session.create({
    data: { tokenHash: sha256(token), userId, kind, mfaVerified: options.mfaVerified ?? kind === 'FARMER', expiresAt, userAgent },
  });
  (await cookies()).set(cookieNameFor(kind), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  return session;
}

export interface ResolvedSession {
  sessionId: string;
  userId: string;
  kind: UserKind;
  mfaVerified: boolean;
  expiresAt: Date;
}

/** Validates the cookie against the database (secure check). */
export async function readSession(kind: UserKind): Promise<ResolvedSession | null> {
  const token = (await cookies()).get(cookieNameFor(kind))?.value;
  if (!token || token.length < 32) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { status: true, kind: true } } },
  });
  if (
    !session ||
    session.kind !== kind ||
    session.user.kind !== kind ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status !== 'ACTIVE'
  ) {
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return { sessionId: session.id, userId: session.userId, kind, mfaVerified: session.mfaVerified, expiresAt: session.expiresAt };
}

export async function markSessionMfaVerified(sessionId: string) {
  await db.session.update({ where: { id: sessionId }, data: { mfaVerified: true } });
}

export async function destroyCurrentSession(kind: UserKind) {
  const store = await cookies();
  const token = store.get(cookieNameFor(kind))?.value;
  if (token) {
    await db.session.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  store.delete(cookieNameFor(kind));
}

export async function revokeSession(userId: string, sessionId: string) {
  const result = await db.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return result.count > 0;
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  const result = await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function listActiveSessions(userId: string) {
  return db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true, kind: true },
    orderBy: { lastSeenAt: 'desc' },
  });
}
