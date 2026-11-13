/**
 * Application sessions (created only after a verified OTP).
 *   - token: 32 random bytes (base64url); PostgreSQL stores only its SHA-256
 *   - web: HttpOnly, SameSite=Lax cookie (Secure in production); mobile: `Authorization: Bearer <token>`
 *   - rotation: a new token on every login; the session this browser presented before is revoked
 *   - expiry: 30 days, or 12 hours for accounts with ADMIN / SUPER_ADMIN
 *   - Redis caches valid sessions for up to 5 minutes; every revocation deletes the cache entry
 */
import 'server-only';
import { cookies, headers } from 'next/headers';
import type { AppRole } from '@prisma/client';
import { SESSION_COOKIE } from '@/lib/auth/session-cookie';
import { db } from '@/server/db';
import { randomToken, sha256 } from './crypto';

export { SESSION_COOKIE };

const USER_TTL_MS = 30 * 86_400_000;
const STAFF_TTL_MS = 12 * 3_600_000;
const TOUCH_INTERVAL_MS = 5 * 60_000;
const CACHE_TTL_SECONDS = 300;

export type SessionClient = 'web' | 'mobile';

export function sessionTtlMs(roles: readonly AppRole[]): number {
  return roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN') ? STAFF_TTL_MS : USER_TTL_MS;
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || (process.env.APP_PUBLIC_URL ?? '').startsWith('https://'),
    sameSite: 'lax' as const,
    path: '/',
    expires,
  };
}

// ---- optional Redis cache --------------------------------------------------------------------

interface CachedSession {
  sessionId: string;
  userId: string;
  expiresAt: string;
}

async function redis() {
  try {
    const { getRedis } = await import('@/server/cache/redis');
    return await getRedis();
  } catch {
    return null;
  }
}

async function cacheGet(tokenHash: string): Promise<CachedSession | null> {
  const client = await redis();
  const raw = client ? await client.get(`session:${tokenHash}`).catch(() => null) : null;
  return raw ? (JSON.parse(raw) as CachedSession) : null;
}

async function cacheSet(tokenHash: string, value: CachedSession, ttlSeconds: number) {
  const client = await redis();
  if (client && ttlSeconds > 0) await client.set(`session:${tokenHash}`, JSON.stringify(value), { EX: ttlSeconds }).catch(() => undefined);
}

async function cacheDel(tokenHashes: string[]) {
  const client = await redis();
  if (client && tokenHashes.length) await client.del(tokenHashes.map((h) => `session:${h}`)).catch(() => undefined);
}

// ---- lifecycle -----------------------------------------------------------------------------

export interface CreatedSession {
  sessionId: string;
  token: string;
  expiresAt: Date;
}

/** Creates a session after successful OTP verification (rotates any session this client presented). */
export async function createSession(userId: string, roles: readonly AppRole[], client: SessionClient = 'web'): Promise<CreatedSession> {
  const previous = await presentedToken();
  if (previous) await revokeToken(previous.token);

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + sessionTtlMs(roles));
  const userAgent = (await headers()).get('user-agent')?.slice(0, 255) ?? null;
  const session = await db.session.create({ data: { tokenHash: sha256(token), userId, client, userAgent, expiresAt } });
  if (client === 'web') (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  return { sessionId: session.id, token, expiresAt };
}

/** The token this request presents: `Authorization: Bearer` (mobile) or the session cookie (web). */
export async function presentedToken(): Promise<{ token: string; via: 'bearer' | 'cookie' } | null> {
  const authorization = (await headers()).get('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    const token = authorization.slice(7).trim();
    if (token.length >= 32 && token.length <= 128) return { token, via: 'bearer' };
  }
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  return cookie && cookie.length >= 32 && cookie.length <= 128 ? { token: cookie, via: 'cookie' } : null;
}

export interface ActiveSession {
  sessionId: string;
  userId: string;
  expiresAt: Date;
}

/** Validates a token (secure check: database, with a short Redis cache). */
export async function resolveSession(token: string): Promise<ActiveSession | null> {
  const tokenHash = sha256(token);
  const now = Date.now();
  const cached = await cacheGet(tokenHash);
  if (cached && new Date(cached.expiresAt).getTime() > now) {
    return { sessionId: cached.sessionId, userId: cached.userId, expiresAt: new Date(cached.expiresAt) };
  }
  const session = await db.session.findUnique({ where: { tokenHash } });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= now) return null;
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  const ttl = Math.min(CACHE_TTL_SECONDS, Math.floor((session.expiresAt.getTime() - now) / 1000));
  await cacheSet(tokenHash, { sessionId: session.id, userId: session.userId, expiresAt: session.expiresAt.toISOString() }, ttl);
  return { sessionId: session.id, userId: session.userId, expiresAt: session.expiresAt };
}

async function revokeToken(token: string) {
  const tokenHash = sha256(token);
  await db.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  await cacheDel([tokenHash]);
}

/** Logout: revokes the presented session and clears the cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const presented = await presentedToken();
  if (presented) await revokeToken(presented.token);
  (await cookies()).delete(SESSION_COOKIE);
}

/** Revokes every active session of a user (logout everywhere, suspension, role removal). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const active = await db.session.findMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    select: { id: true, tokenHash: true },
  });
  if (!active.length) return 0;
  await db.session.updateMany({ where: { id: { in: active.map((s) => s.id) } }, data: { revokedAt: new Date() } });
  await cacheDel(active.map((s) => s.tokenHash));
  return active.length;
}

export async function listActiveSessions(userId: string) {
  return db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, client: true, userAgent: true, createdAt: true, lastSeenAt: true },
    orderBy: { lastSeenAt: 'desc' },
  });
}
