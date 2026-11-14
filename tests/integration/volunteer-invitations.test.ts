/**
 * Volunteer invitation links against the real PostgreSQL database: only the token HASH is stored,
 * tokens resolve to their invitation, expiry/revocation states, acceptance requires the invited
 * phone, single use under concurrent acceptance, and invitation details reach the profile.
 * Rows created here are removed afterwards.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite('volunteer invitations (integration)', () => {
  let db: typeof import('@/server/db').db;
  let identity: typeof import('@/server/auth/identity');
  let inv: typeof import('@/server/volunteer/invitations');
  const tag = Date.now().toString().slice(-6);
  const prefix = `+1998${tag}`;
  const p = (n: number) => `${prefix}${n}`;
  let inviter: string;

  const invite = async (phone: string, extra: Record<string, unknown> = {}, expiresInMs = 86_400_000) => {
    const { token, tokenHash } = inv.newInviteToken();
    const row = await db.roleInvitation.create({
      data: { phone, role: 'VOLUNTEER', tokenHash, invitedById: inviter, expiresAt: new Date(Date.now() + expiresInMs), ...extra },
    });
    return { token, row };
  };

  beforeAll(async () => {
    ({ db } = await import('@/server/db'));
    identity = await import('@/server/auth/identity');
    inv = await import('@/server/volunteer/invitations');
    inviter = (await db.user.create({ data: { name: 'test inviter' } })).id;
  }, 60_000);

  afterAll(async () => {
    await db.roleInvitation.deleteMany({ where: { invitedById: inviter } });
    await db.user.deleteMany({ where: { OR: [{ phone: { startsWith: prefix } }, { id: inviter }] } });
  });

  it('stores only the token hash; the raw token resolves, a tampered one does not', async () => {
    const { token, row } = await invite(p(1));
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.tokenHash).not.toContain(token);
    expect((await inv.findInvitationByToken(token))?.id).toBe(row.id);
    expect(await inv.findInvitationByToken(`${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`)).toBeNull();
    expect(await inv.findInvitationByToken('../../etc')).toBeNull();
  });

  it('reports expired and revoked invitations', async () => {
    const expired = await invite(p(2), {}, -1000);
    expect((await inv.findInvitationByToken(expired.token))?.state).toBe('EXPIRED');
    const revoked = await invite(p(3), { status: 'REVOKED' });
    expect((await inv.findInvitationByToken(revoked.token))?.state).toBe('REVOKED');
  });

  it('a different verified phone cannot accept; the invited phone becomes a volunteer with the invite details', async () => {
    const { token } = await invite(p(4), { inviteeName: 'Sunita Devi', serviceArea: 'Dankaur block', district: 'Gautam Buddha Nagar', village: 'Kasna' });
    expect(await identity.completePhoneLogin(p(5), 'volunteer')).toEqual({ ok: false, reason: 'VOLUNTEER_NOT_AUTHORISED' });
    expect((await inv.findInvitationByToken(token))?.state).toBe('PENDING');

    const login = await identity.completePhoneLogin(p(4), 'volunteer');
    expect(login).toMatchObject({ ok: true, roles: ['VOLUNTEER'] });
    if (!login.ok) return;
    const user = await db.user.findUnique({ where: { id: login.userId }, include: { volunteerProfile: true } });
    expect(user?.name).toBe('Sunita Devi');
    expect(user?.volunteerProfile).toMatchObject({ serviceArea: 'Dankaur block', district: 'Gautam Buddha Nagar', village: 'Kasna', verificationStatus: 'PENDING' });
    const after = await inv.findInvitationByToken(token);
    expect(after?.state).toBe('ACCEPTED');
    expect(after?.acceptedUserId).toBe(login.userId);
  });

  it('is single use under concurrent acceptance (no errors, role added once)', async () => {
    const farmer = await identity.completePhoneLogin(p(6), 'farmer');
    if (!farmer.ok) throw new Error('setup');
    const { token } = await invite(p(6));
    const results = await Promise.allSettled([identity.refreshInvitations(farmer.userId, p(6)), identity.refreshInvitations(farmer.userId, p(6))]);
    const added = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    expect(added).toEqual(['VOLUNTEER']);
    expect((await db.userRole.findMany({ where: { userId: farmer.userId } })).map((r) => r.role).sort()).toEqual(['FARMER', 'VOLUNTEER']);
    expect((await inv.findInvitationByToken(token))?.state).toBe('ACCEPTED');
  });
});
