/**
 * Session security against the real PostgreSQL (and Redis cache, when running):
 * hashed storage, HttpOnly cookie, rotation on login, logout, revoke-everywhere with cache
 * invalidation, expiry, Bearer tokens for mobile, shorter staff sessions.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();
const requestHeaders = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => void jar.set(name, { value, options }),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => ({ get: (name: string) => requestHeaders.get(name.toLowerCase()) ?? null }),
}));

const enabled = Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

suite('sessions (integration)', () => {
  let db: typeof import('@/server/db').db;
  let session: typeof import('@/server/auth/session');
  let farmerId: string;
  let adminId: string;

  beforeAll(async () => {
    ({ db } = await import('@/server/db'));
    session = await import('@/server/auth/session');
    farmerId = (await db.user.create({ data: { name: 'session test farmer' } })).id;
    adminId = (await db.user.create({ data: { name: 'session test admin' } })).id;
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: [farmerId, adminId] } } });
  });

  beforeEach(() => {
    jar.clear();
    requestHeaders.clear();
  });

  it('stores only the SHA-256 of the token and sets an HttpOnly, SameSite=Lax cookie', async () => {
    const created = await session.createSession(farmerId, ['FARMER']);
    const row = await db.session.findUniqueOrThrow({ where: { id: created.sessionId } });
    expect(row.tokenHash).toBe(sha256(created.token));
    expect(row.tokenHash).not.toContain(created.token);
    const cookie = jar.get(session.SESSION_COOKIE);
    expect(cookie?.value).toBe(created.token);
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    expect(created.token.length).toBeGreaterThanOrEqual(43); // 32 random bytes, base64url
    expect((await session.resolveSession(created.token))?.userId).toBe(farmerId);
  });

  it('rotates on login: the session this browser presented before is revoked', async () => {
    const first = await session.createSession(farmerId, ['FARMER']);
    const second = await session.createSession(farmerId, ['FARMER']);
    expect(await session.resolveSession(first.token)).toBeNull();
    expect((await session.resolveSession(second.token))?.sessionId).toBe(second.sessionId);
    expect(jar.get(session.SESSION_COOKIE)?.value).toBe(second.token);
  });

  it('logout revokes the session (also in the cache) and clears the cookie', async () => {
    const created = await session.createSession(farmerId, ['FARMER']);
    expect(await session.resolveSession(created.token)).not.toBeNull(); // now cached
    await session.destroyCurrentSession();
    expect(jar.has(session.SESSION_COOKIE)).toBe(false);
    expect(await session.resolveSession(created.token)).toBeNull();
  });

  it('revokeAllSessions ends every session of the user, including cached ones', async () => {
    const a = await session.createSession(farmerId, ['FARMER'], 'mobile');
    const b = await session.createSession(farmerId, ['FARMER'], 'mobile');
    await session.resolveSession(a.token);
    await session.resolveSession(b.token);
    expect(await session.revokeAllSessions(farmerId)).toBeGreaterThanOrEqual(2);
    expect(await session.resolveSession(a.token)).toBeNull();
    expect(await session.resolveSession(b.token)).toBeNull();
  });

  it('expired sessions are rejected', async () => {
    const created = await session.createSession(farmerId, ['FARMER'], 'mobile');
    // not resolved before, so nothing is cached: the database row decides
    await db.session.update({ where: { id: created.sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await session.resolveSession(created.token)).toBeNull();
  });

  it('mobile sessions use a Bearer token and set no cookie', async () => {
    const created = await session.createSession(farmerId, ['FARMER'], 'mobile');
    expect(jar.has(session.SESSION_COOKIE)).toBe(false);
    requestHeaders.set('authorization', `Bearer ${created.token}`);
    expect(await session.presentedToken()).toEqual({ token: created.token, via: 'bearer' });
  });

  it('administrator sessions are short (12 h); farmer sessions last 30 days', async () => {
    expect(session.sessionTtlMs(['ADMIN'])).toBe(12 * 3_600_000);
    expect(session.sessionTtlMs(['SUPER_ADMIN', 'FARMER'])).toBe(12 * 3_600_000);
    expect(session.sessionTtlMs(['FARMER', 'VOLUNTEER'])).toBe(30 * 86_400_000);
    const created = await session.createSession(adminId, ['ADMIN'], 'mobile');
    expect(created.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(12 * 3_600_000);
  });

  it('ignores malformed tokens', async () => {
    requestHeaders.set('authorization', 'Bearer short');
    jar.set(session.SESSION_COOKIE, { value: 'x'.repeat(10) });
    expect(await session.presentedToken()).toBeNull();
    expect(await session.resolveSession('not-a-real-token-but-long-enough-to-be-checked-123')).toBeNull();
  });
});
