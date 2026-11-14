/**
 * Mobile (Flutter) sessions against the real PostgreSQL: short-lived access token + rotating
 * refresh token on the shared `sessions` table, replay detection, logout by refresh token,
 * suspended accounts, and the REST envelope of POST /api/v1/auth/token/refresh.
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

function jsonRequest(url: string, body: unknown) {
  return new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

suite('mobile sessions (integration)', () => {
  let db: typeof import('@/server/db').db;
  let session: typeof import('@/server/auth/session');
  let farmerId: string;
  let staffId: string;

  beforeAll(async () => {
    ({ db } = await import('@/server/db'));
    session = await import('@/server/auth/session');
    farmerId = (await db.user.create({ data: { name: 'mobile session farmer', roles: { create: { role: 'FARMER' } } } })).id;
    staffId = (await db.user.create({ data: { name: 'mobile session admin', roles: { create: { role: 'ADMIN' } } } })).id;
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: [farmerId, staffId] } } });
  });

  beforeEach(() => {
    jar.clear();
    requestHeaders.clear();
  });

  it('issues a 15-minute access token and a separate refresh token; stores only hashes; sets no cookie', async () => {
    const created = await session.createSession(farmerId, ['FARMER'], 'mobile', { deviceId: 'install_abc12345', deviceName: 'Android 15 · test' });
    expect(created.refreshToken).toBeTruthy();
    expect(created.refreshToken).not.toBe(created.token);
    expect(created.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(session.MOBILE_ACCESS_TTL_MS);
    expect(created.refreshExpiresAt!.getTime() - Date.now()).toBeGreaterThan(29 * 86_400_000);
    const row = await db.session.findUniqueOrThrow({ where: { id: created.sessionId } });
    expect(row.tokenHash).toBe(sha256(created.token));
    expect(row.refreshTokenHash).toBe(sha256(created.refreshToken!));
    expect(row.client).toBe('mobile');
    expect(row.deviceId).toBe('install_abc12345');
    expect(jar.size).toBe(0);
    expect((await session.resolveSession(created.token))?.userId).toBe(farmerId);
  });

  it('refresh rotates both tokens; the old access token stops working immediately (cache too)', async () => {
    const created = await session.createSession(farmerId, ['FARMER'], 'mobile');
    await session.resolveSession(created.token); // cached now
    const refreshed = await session.refreshMobileSession(created.refreshToken!);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(refreshed.sessionId).toBe(created.sessionId);
    expect(refreshed.accessToken).not.toBe(created.token);
    expect(refreshed.refreshToken).not.toBe(created.refreshToken);
    expect(await session.resolveSession(created.token)).toBeNull();
    expect((await session.resolveSession(refreshed.accessToken))?.userId).toBe(farmerId);
  });

  it('a just-rotated refresh token is a race (409-style) inside the window, without revoking', async () => {
    const created = await session.createSession(farmerId, ['FARMER'], 'mobile');
    const first = await session.refreshMobileSession(created.refreshToken!);
    expect(first.ok).toBe(true);
    const again = await session.refreshMobileSession(created.refreshToken!);
    expect(again).toEqual({ ok: false, reason: 'RACE' });
    if (first.ok) expect((await session.resolveSession(first.accessToken))?.userId).toBe(farmerId);
  });

  it('replaying an old refresh token after the race window revokes the whole session', async () => {
    const created = await session.createSession(farmerId, ['FARMER'], 'mobile');
    const first = await session.refreshMobileSession(created.refreshToken!);
    expect(first.ok).toBe(true);
    await db.session.update({ where: { id: created.sessionId }, data: { rotatedAt: new Date(Date.now() - 5 * 60_000) } });
    expect(await session.refreshMobileSession(created.refreshToken!)).toEqual({ ok: false, reason: 'REUSED' });
    const row = await db.session.findUniqueOrThrow({ where: { id: created.sessionId } });
    expect(row.revokedAt).not.toBeNull();
    if (first.ok) {
      expect(await session.resolveSession(first.accessToken)).toBeNull();
      expect(await session.refreshMobileSession(first.refreshToken)).toEqual({ ok: false, reason: 'REVOKED' });
    }
  });

  it('expired refresh tokens and unknown tokens are rejected', async () => {
    const created = await session.createSession(farmerId, ['FARMER'], 'mobile');
    await db.session.update({ where: { id: created.sessionId }, data: { refreshExpiresAt: new Date(Date.now() - 1000) } });
    expect(await session.refreshMobileSession(created.refreshToken!)).toEqual({ ok: false, reason: 'EXPIRED' });
    expect(await session.refreshMobileSession('x'.repeat(43))).toEqual({ ok: false, reason: 'INVALID' });
    expect(await session.refreshMobileSession('short')).toEqual({ ok: false, reason: 'INVALID' });
  });

  it('web session tokens cannot be used as refresh tokens', async () => {
    const web = await session.createSession(farmerId, ['FARMER'], 'web');
    expect(await session.refreshMobileSession(web.token)).toEqual({ ok: false, reason: 'INVALID' });
  });

  it('a suspended account cannot refresh, and its session is revoked', async () => {
    const created = await session.createSession(farmerId, ['FARMER'], 'mobile');
    await db.user.update({ where: { id: farmerId }, data: { status: 'SUSPENDED' } });
    try {
      expect(await session.refreshMobileSession(created.refreshToken!)).toEqual({ ok: false, reason: 'ACCOUNT_INACTIVE' });
      expect((await db.session.findUniqueOrThrow({ where: { id: created.sessionId } })).revokedAt).not.toBeNull();
    } finally {
      await db.user.update({ where: { id: farmerId }, data: { status: 'ACTIVE' } });
    }
  });

  it('staff refresh tokens never outlive 12 hours from sign-in', async () => {
    const created = await session.createSession(staffId, ['ADMIN'], 'mobile');
    expect(created.refreshExpiresAt!.getTime() - Date.now()).toBeLessThanOrEqual(12 * 3_600_000);
    const refreshed = await session.refreshMobileSession(created.refreshToken!);
    expect(refreshed.ok).toBe(true);
    if (refreshed.ok) expect(refreshed.refreshExpiresAt.getTime() - Date.now()).toBeLessThanOrEqual(12 * 3_600_000);
  });

  it('logout by refresh token revokes the session even when the access token is gone', async () => {
    const created = await session.createSession(farmerId, ['FARMER'], 'mobile');
    expect(await session.revokeByRefreshToken(created.refreshToken!)).toBe(true);
    expect(await session.resolveSession(created.token)).toBeNull();
    expect(await session.refreshMobileSession(created.refreshToken!)).toEqual({ ok: false, reason: 'REVOKED' });
  });

  it('listActiveSessions keeps a mobile session between access tokens', async () => {
    const created = await session.createSession(farmerId, ['FARMER'], 'mobile');
    await db.session.update({ where: { id: created.sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const active = await session.listActiveSessions(farmerId);
    expect(active.some((s) => s.id === created.sessionId)).toBe(true);
  });

  it('POST /api/v1/auth/token/refresh returns the rotated pair and maps failures to codes', async () => {
    const { POST } = await import('@/app/api/v1/auth/token/refresh/route');
    const created = await session.createSession(farmerId, ['FARMER'], 'mobile');
    const res = await POST(jsonRequest('http://localhost/api/v1/auth/token/refresh', { refreshToken: created.refreshToken }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: Record<string, string> };
    expect(body.success).toBe(true);
    expect(body.data.tokenType).toBe('Bearer');
    expect(body.data.accessToken).toHaveLength(43);
    expect(body.data.refreshToken).toHaveLength(43);
    expect(Date.parse(body.data.accessTokenExpiresAt)).toBeGreaterThan(Date.now());

    const bad = await POST(jsonRequest('http://localhost/api/v1/auth/token/refresh', { refreshToken: 'y'.repeat(43) }));
    expect(bad.status).toBe(401);
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe('REFRESH_INVALID');

    const notJson = await POST(new Request('http://localhost/api/v1/auth/token/refresh', { method: 'POST', body: 'x' }));
    expect(notJson.status).toBe(415);
  });
});
