/**
 * Phone-login identity rules against the real PostgreSQL database (the OTP is already approved):
 * farmer self-registration, invitation-only VOLUNTEER/ADMIN, no account for uninvited staff tabs,
 * role preservation, account-status denial, no duplicate accounts, expired invitations ignored.
 * Rows created here are removed afterwards.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite('phone login identity (integration)', () => {
  let db: typeof import('@/server/db').db;
  let completePhoneLogin: typeof import('@/server/auth/identity').completePhoneLogin;
  let refreshInvitations: typeof import('@/server/auth/identity').refreshInvitations;
  const tag = Date.now().toString().slice(-6);
  const prefix = `+1999${tag}`;
  const p = (n: number) => `${prefix}${n}`;
  let inviter: string;

  const invite = (phone: string, role: 'VOLUNTEER' | 'ADMIN', expiresInMs = 86_400_000, serviceArea?: string) =>
    db.roleInvitation.create({ data: { phone, role, serviceArea, invitedById: inviter, expiresAt: new Date(Date.now() + expiresInMs) } });
  const roles = async (userId: string) => (await db.userRole.findMany({ where: { userId } })).map((r) => r.role).sort();

  beforeAll(async () => {
    ({ db } = await import('@/server/db'));
    ({ completePhoneLogin, refreshInvitations } = await import('@/server/auth/identity'));
    inviter = (await db.user.create({ data: { name: 'test inviter' } })).id;
  });

  afterAll(async () => {
    await db.roleInvitation.deleteMany({ where: { invitedById: inviter } });
    await db.user.deleteMany({ where: { OR: [{ phone: { startsWith: prefix } }, { id: inviter }] } });
  });

  it('a new number on the Farmer tab becomes a FARMER with a minimal profile (chosen language)', async () => {
    const first = await completePhoneLogin(p(1), 'farmer', { language: 'hi' });
    expect(first).toMatchObject({ ok: true, created: true, roles: ['FARMER'] });
    if (!first.ok) return;
    expect((await db.farmerProfile.findUnique({ where: { userId: first.userId } }))?.language).toBe('hi');
    const again = await completePhoneLogin(p(1), 'farmer');
    expect(again).toMatchObject({ ok: true, created: false, userId: first.userId });
    expect(await db.user.count({ where: { phone: p(1) } })).toBe(1);
  });

  it('an uninvited new number on the Volunteer or Admin tab gets no account', async () => {
    expect(await completePhoneLogin(p(2), 'volunteer')).toEqual({ ok: false, reason: 'VOLUNTEER_NOT_AUTHORISED' });
    expect(await completePhoneLogin(p(2), 'admin')).toEqual({ ok: false, reason: 'ADMIN_NOT_AUTHORISED' });
    expect(await db.user.count({ where: { phone: p(2) } })).toBe(0);
  });

  it('an invited number gets VOLUNTEER only (no FARMER) and the invitation is accepted', async () => {
    await invite(p(3), 'VOLUNTEER', 86_400_000, 'Test block');
    const login = await completePhoneLogin(p(3), 'volunteer');
    expect(login).toMatchObject({ ok: true, created: true, roles: ['VOLUNTEER'] });
    if (!login.ok) return;
    expect((await db.volunteerProfile.findUnique({ where: { userId: login.userId } }))?.serviceArea).toBe('Test block');
    expect((await db.roleInvitation.findFirst({ where: { phone: p(3) } }))?.status).toBe('ACCEPTED');
  });

  it('an existing farmer invited later keeps FARMER and gains VOLUNTEER on the same account', async () => {
    const farmer = await completePhoneLogin(p(1), 'farmer');
    if (!farmer.ok) throw new Error('setup');
    await invite(p(1), 'VOLUNTEER');
    const volunteer = await completePhoneLogin(p(1), 'volunteer');
    expect(volunteer).toMatchObject({ ok: true, userId: farmer.userId, rolesAdded: ['VOLUNTEER'] });
    expect(await roles(farmer.userId)).toEqual(['FARMER', 'VOLUNTEER']);
  });

  it('the Admin tab never grants ADMIN: a farmer signs in with farmer roles only', async () => {
    const login = await completePhoneLogin(p(1), 'admin');
    expect(login.ok && login.roles.includes('ADMIN')).toBe(false);
    expect(login.ok && login.roles.includes('SUPER_ADMIN')).toBe(false);
  });

  it('a pre-provisioned administrator signs in without being given FARMER', async () => {
    const admin = await db.user.create({ data: { phone: p(4), roles: { create: { role: 'SUPER_ADMIN' } } } });
    const login = await completePhoneLogin(p(4), 'admin');
    expect(login).toMatchObject({ ok: true, userId: admin.id, created: false, roles: ['SUPER_ADMIN'] });
  });

  it('an invited administrator (new number) gets ADMIN with the invited level', async () => {
    await db.roleInvitation.create({ data: { phone: p(5), role: 'ADMIN', adminLevel: 'AGRONOMIST', invitedById: inviter, expiresAt: new Date(Date.now() + 86_400_000) } });
    const login = await completePhoneLogin(p(5), 'admin');
    expect(login).toMatchObject({ ok: true, roles: ['ADMIN'] });
    if (!login.ok) return;
    expect((await db.adminProfile.findUnique({ where: { userId: login.userId } }))?.adminLevel).toBe('AGRONOMIST');
  });

  it('expired invitations are ignored', async () => {
    await invite(p(6), 'ADMIN', -1000);
    expect(await completePhoneLogin(p(6), 'admin')).toEqual({ ok: false, reason: 'ADMIN_NOT_AUTHORISED' });
    expect(await db.user.count({ where: { phone: p(6) } })).toBe(0);
  });

  it('suspended, pending and disabled accounts are refused even after a correct OTP', async () => {
    const user = await db.user.create({ data: { phone: p(7), roles: { create: { role: 'FARMER' } } } });
    for (const [status, reason] of [
      ['SUSPENDED', 'ACCOUNT_SUSPENDED'],
      ['PENDING', 'ACCOUNT_PENDING'],
      ['DISABLED', 'ACCOUNT_DISABLED'],
    ] as const) {
      await db.user.update({ where: { id: user.id }, data: { status } });
      expect(await completePhoneLogin(p(7), 'farmer')).toEqual({ ok: false, reason });
    }
  });

  it('refreshInvitations accepts an invitation created after the last login', async () => {
    const login = await completePhoneLogin(p(8), 'farmer');
    if (!login.ok) throw new Error('setup');
    await invite(p(8), 'VOLUNTEER');
    expect(await refreshInvitations(login.userId, p(8))).toEqual(['VOLUNTEER']);
    expect(await roles(login.userId)).toEqual(['FARMER', 'VOLUNTEER']);
  });
});
