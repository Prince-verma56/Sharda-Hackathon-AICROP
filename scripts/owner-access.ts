/**
 * Applies owner/developer access now (also happens automatically at the next OTP login):
 * every number in AUTH_OWNER_PHONES that already has an account gets SUPER_ADMIN + FARMER +
 * VOLUNTEER, and admin becomes its default workspace.
 *
 *   npm run auth:owners
 *
 * Reads AUTH_OWNER_PHONES from .env.local / .env. Numbers without an account are created at
 * their first verified OTP login.
 */
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

async function main() {
  const { ensureOwnerAccess, ownerPhones } = await import('../server/auth/owner');
  const { db } = await import('../server/db/index');
  const phones = [...ownerPhones()];
  if (!phones.length) throw new Error('AUTH_OWNER_PHONES is empty.');
  for (const phone of phones) {
    const user = await db.user.findUnique({ where: { phone } });
    if (!user) {
      console.log(`${phone.slice(0, 3)}…${phone.slice(-4)}: no account yet (granted at first OTP login)`);
      continue;
    }
    const added = await db.$transaction((tx) => ensureOwnerAccess(tx, user.id));
    await db.user.update({ where: { id: user.id }, data: { activeWorkspace: 'admin' } });
    await db.auditLog.create({ data: { actorId: user.id, action: 'auth.owner_access', resource: 'user', resourceId: user.id, metadata: { added } } });
    console.log(`${phone.slice(0, 3)}…${phone.slice(-4)}: roles added ${added.length ? added.join(', ') : '(already complete)'}`);
  }
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
