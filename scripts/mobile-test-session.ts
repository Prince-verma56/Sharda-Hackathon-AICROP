/**
 * DEVELOPMENT ONLY — mints a mobile (Flutter) session for an automated test farmer, so the
 * mobile acceptance / integration tests can run against the real local backend and the real
 * AgriSmart model without someone reading an SMS. Real OTP sign-in is tested by hand.
 *
 *   npm run mobile:test-session                 # prints { accessToken, refreshToken, ... }
 *   npm run mobile:test-session -- --cleanup    # deletes the test farmer and all its data
 *
 * Refuses to run when NODE_ENV=production or when DATABASE_URL is not a local database.
 * The test farmer uses a reserved fake number (+91 90000 00099) and is named so it is obvious.
 */
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const TEST_PHONE = '+919000000099';

function assertDevelopmentDatabase() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run: NODE_ENV=production.');
  const url = process.env.DATABASE_URL ?? '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('DATABASE_URL is missing or invalid.');
  }
  if (!['localhost', '127.0.0.1', '::1', 'postgres', 'db'].includes(host)) {
    throw new Error(`Refusing to run against a non-local database host (${host}).`);
  }
}

async function main() {
  assertDevelopmentDatabase();
  const { db } = await import('../server/db/index');
  const cleanup = process.argv.includes('--cleanup');

  const existing = await db.user.findUnique({ where: { phone: TEST_PHONE } });
  if (cleanup) {
    if (existing) await db.user.delete({ where: { id: existing.id } });
    console.log(JSON.stringify({ deleted: Boolean(existing) }));
    await db.$disconnect();
    return;
  }

  const user =
    existing ??
    (await db.user.create({
      data: {
        phone: TEST_PHONE,
        phoneVerifiedAt: new Date(),
        name: 'Mobile E2E Test Farmer',
        roles: { create: { role: 'FARMER' } },
        farmerProfile: { create: { language: 'en', preferredName: 'Test Farmer', onboardedAt: new Date(), photoConsentAt: new Date(), mainCrops: ['tomato', 'potato'] } },
      },
    }));
  const { insertMobileSession } = await import('../server/auth/session');
  const session = await insertMobileSession(user.id, ['FARMER'], { deviceId: 'e2e_test_device', deviceName: 'Automated mobile test', userAgent: 'mobile-test-session-script' });
  console.log(
    JSON.stringify({
      userId: user.id,
      sessionId: session.sessionId,
      accessToken: session.token,
      accessTokenExpiresAt: session.expiresAt.toISOString(),
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshExpiresAt?.toISOString(),
    }),
  );
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
