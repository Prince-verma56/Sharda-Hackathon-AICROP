/**
 * One-time, server-side bootstrap of the FIRST super admin (no public admin registration).
 *
 *   npm run admin:bootstrap -- --phone +919876543210 [--name "Name"]
 *
 * - Refuses to run if any SUPER_ADMIN already exists (later admins are invited in the portal).
 * - Works before or after that person's first login: the account is matched by phone, and the
 *   person still has to prove ownership of the number with an OTP to sign in.
 * - Keeps any existing roles (e.g. FARMER).
 */
import 'dotenv/config';
import { normalizePhoneE164 } from '../server/auth/phone';
import { db } from '../server/db/index';

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const phone = normalizePhoneE164(arg('phone') ?? '');
  if (!phone) throw new Error('Usage: npm run admin:bootstrap -- --phone +919876543210 [--name "Name"]');
  if (await db.userRole.findFirst({ where: { role: 'SUPER_ADMIN', user: { phone: { not: null }, status: 'ACTIVE' } } })) {
    throw new Error('A super admin with a phone already exists. Invite further admins from /admin/settings.');
  }
  const name = arg('name') ?? null;
  const user = await db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { phone } });
    const u = existing ?? (await tx.user.create({ data: { phone, name } }));
    await tx.userRole.upsert({ where: { userId_role: { userId: u.id, role: 'SUPER_ADMIN' } }, create: { userId: u.id, role: 'SUPER_ADMIN' }, update: {} });
    await tx.adminProfile.upsert({ where: { userId: u.id }, create: { userId: u.id, adminLevel: 'ADMIN' }, update: {} });
    return u;
  });
  await db.auditLog.create({ data: { actorId: user.id, action: 'admin.bootstrap_cli', resource: 'user', resourceId: user.id, metadata: { role: 'SUPER_ADMIN' } } });
  console.log(`SUPER_ADMIN granted to ${phone}. Sign in at /login?role=admin with this number (phone OTP).`);
}

main()
  .catch((error) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
