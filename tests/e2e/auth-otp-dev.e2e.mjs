/**
 * End-to-end check of the phone-OTP login against a RUNNING dev server that uses the free
 * development provider (AUTH_OTP_PROVIDER=dev in .env.development.local). No SMS is sent.
 *
 *   node tests/e2e/auth-otp-dev.e2e.mjs [baseUrl]      (default http://localhost:3000)
 *
 * Uses test numbers +91 90000 99xxx and removes every row it created at the end.
 * The development code is read from AUTH_DEV_OTP_CODE (default 424242), never from the API.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const devEnv = (() => {
  try {
    return Object.fromEntries(
      readFileSync('.env.development.local', 'utf8')
        .split(/\r?\n/)
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    );
  } catch {
    return {};
  }
})();
const CODE = devEnv.AUTH_DEV_OTP_CODE || '424242';
const PREFIX = '+9190000990';
const phone = (n) => `${PREFIX}${String(n).padStart(2, '0')}`;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

let passed = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) passed += 1;
  else failures.push(`${name} ${detail}`);
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `  ${detail}`}`);
}

class Browser {
  cookies = new Map();
  async request(path, { method = 'GET', body, headers = {} } = {}) {
    const response = await fetch(`${BASE}${path}`, {
      method,
      redirect: 'manual',
      headers: {
        ...(body ? { 'content-type': 'application/json', origin: BASE } : {}),
        ...(this.cookies.size ? { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const [name, value] = [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
      if (!value || /expires=Thu, 01 Jan 1970/i.test(raw)) this.cookies.delete(name);
      else this.cookies.set(name, value);
      this.lastSetCookie = raw;
    }
    const json = response.headers.get('content-type')?.includes('json') ? await response.json() : null;
    return { status: response.status, json, location: response.headers.get('location') };
  }
  start(n, role = 'FARMER') {
    return this.request('/api/v1/auth/otp/start', { method: 'POST', body: { phoneNumber: phone(n), requestedRole: role, language: 'en' } });
  }
  verify(n, code = CODE, role = 'FARMER', extra = {}) {
    return this.request('/api/v1/auth/otp/verify', { method: 'POST', body: { phoneNumber: phone(n), code, requestedRole: role, language: 'en', ...extra } });
  }
}

async function cleanup() {
  await db.query(`DELETE FROM role_invitations WHERE phone LIKE $1`, [`${PREFIX}%`]);
  await db.query(`DELETE FROM users WHERE phone LIKE $1`, [`${PREFIX}%`]);
}

async function main() {
  await db.connect();
  await cleanup();
  const inviter = (await db.query(`SELECT id FROM users WHERE id IN (SELECT "userId" FROM user_roles WHERE role = 'SUPER_ADMIN') LIMIT 1`)).rows[0]?.id;

  // 1. new farmer
  const farmer = new Browser();
  let r = await farmer.start(1);
  check('start returns pending without any code', r.status === 200 && r.json?.data?.status === 'pending' && !JSON.stringify(r.json).includes(CODE), JSON.stringify(r.json));
  check('dev provider says no SMS was sent', r.json?.data?.delivery === 'development');
  r = await farmer.start(1);
  check('resend cooldown enforced', r.status === 429 && r.json?.error?.code === 'OTP_COOLDOWN', JSON.stringify(r.json));
  r = await farmer.verify(1, '000000');
  check('wrong code rejected with attempts left', r.status === 401 && r.json?.error?.code === 'OTP_INVALID' && r.json?.error?.details?.attemptsLeft === 4, JSON.stringify(r.json));
  check('no session after a wrong code', !farmer.cookies.has('cropai_session'));
  r = await farmer.verify(1);
  check('correct code signs in a new farmer', r.status === 200 && r.json?.data?.roles?.join() === 'FARMER', JSON.stringify(r.json));
  check('session cookie is HttpOnly + SameSite=Lax', /HttpOnly/i.test(farmer.lastSetCookie ?? '') && /SameSite=lax/i.test(farmer.lastSetCookie ?? ''), farmer.lastSetCookie);
  check('web login returns no token in the body', !('token' in (r.json?.data ?? {})));
  r = await farmer.verify(1);
  check('a code cannot be reused', r.status === 401 && r.json?.error?.code === 'OTP_EXPIRED', JSON.stringify(r.json));
  r = await farmer.request('/api/v1/auth/me');
  check('/me returns the farmer and its workspaces', r.status === 200 && r.json?.data?.workspaces?.join() === 'farmer', JSON.stringify(r.json));
  r = await farmer.request('/auth/continue?role=farmer&next=/farmer/scan');
  check('post-login goes to the intended page', r.status === 307 && r.location?.endsWith('/farmer/scan'), `${r.status} ${r.location}`);
  r = await farmer.request('/login?role=farmer&next=/farmer/scan');
  check('signed-in user skips the login page', r.status === 307 && r.location?.includes('/auth/continue'), `${r.status} ${r.location}`);
  r = await farmer.request('/auth/continue?role=admin');
  check('farmer choosing Admin is denied (no redirect to admin)', r.status === 200, `${r.status} ${r.location}`);
  r = await farmer.request('/admin');
  check('farmer cannot open /admin', r.status === 307 && !r.location?.endsWith('/admin'), `${r.status} ${r.location}`);

  // 2. existing farmer signs in again (same account)
  const again = new Browser();
  await again.start(1).then(async (x) => (x.status === 429 ? new Promise((res) => setTimeout(res, 31_000)).then(() => again.start(1)) : x));
  r = await again.verify(1);
  const count = (await db.query(`SELECT count(*)::int AS n FROM users WHERE phone = $1`, [phone(1)])).rows[0].n;
  check('existing farmer signs in to the same account', r.status === 200 && count === 1, `${r.status} users=${count}`);

  // 3. uninvited volunteer / admin: no account, no session
  const stranger = new Browser();
  await stranger.start(2, 'VOLUNTEER');
  r = await stranger.verify(2, CODE, 'VOLUNTEER');
  check('uninvited volunteer is denied', r.status === 403 && r.json?.error?.code === 'VOLUNTEER_NOT_AUTHORISED', JSON.stringify(r.json));
  const intruder = new Browser();
  await intruder.start(3, 'ADMIN');
  r = await intruder.verify(3, CODE, 'ADMIN');
  check('unauthorised admin is denied', r.status === 403 && r.json?.error?.code === 'ADMIN_NOT_AUTHORISED', JSON.stringify(r.json));
  const created = (await db.query(`SELECT count(*)::int AS n FROM users WHERE phone IN ($1, $2)`, [phone(2), phone(3)])).rows[0].n;
  check('denied staff attempts create no account and no session', created === 0 && !stranger.cookies.has('cropai_session') && !intruder.cookies.has('cropai_session'));

  // 4. invited volunteer
  if (inviter) {
    await db.query(
      `INSERT INTO role_invitations (id, phone, role, "serviceArea", "invitedById", status, "expiresAt") VALUES ($1, $2, 'VOLUNTEER', 'E2E block', $3, 'PENDING', now() + interval '1 day')`,
      [`e2e_${Date.now()}`, phone(4), inviter],
    );
    const volunteer = new Browser();
    await volunteer.start(4, 'VOLUNTEER');
    r = await volunteer.verify(4, CODE, 'VOLUNTEER');
    check('invited volunteer gets VOLUNTEER only', r.status === 200 && r.json?.data?.roles?.join() === 'VOLUNTEER', JSON.stringify(r.json));
    r = await volunteer.request('/auth/continue?role=volunteer');
    check('volunteer lands in /volunteer', r.status === 307 && r.location?.endsWith('/volunteer'), `${r.status} ${r.location}`);
  } else {
    console.log('SKIP  invited volunteer (no SUPER_ADMIN to act as inviter)');
  }

  // 5. pre-provisioned administrator with a farmer role too (multi-role)
  const adminId = `e2e_admin_${Date.now()}`;
  await db.query(`INSERT INTO users (id, phone, role, status, "createdAt", "updatedAt") VALUES ($1, $2, 'user', 'ACTIVE', now(), now())`, [adminId, phone(5)]);
  await db.query(`INSERT INTO user_roles (id, "userId", role) VALUES ($1, $2, 'ADMIN'), ($3, $2, 'FARMER')`, [`${adminId}_a`, adminId, `${adminId}_f`]);
  const admin = new Browser();
  await admin.start(5, 'ADMIN');
  r = await admin.verify(5, CODE, 'ADMIN');
  check('pre-provisioned admin signs in', r.status === 200 && r.json?.data?.workspaces?.includes('admin'), JSON.stringify(r.json));
  r = await admin.request('/auth/continue?role=admin');
  check('admin tab lands in /admin', r.status === 307 && r.location?.endsWith('/admin'), `${r.status} ${r.location}`);
  r = await admin.request('/auth/continue');
  check('multi-role user without a choice sees the workspace chooser', r.status === 307 && r.location?.endsWith('/workspaces'), `${r.status} ${r.location}`);
  r = await admin.request('/admin');
  check('admin can open /admin', r.status === 200, `${r.status} ${r.location}`);

  // 6. suspended account
  await db.query(`UPDATE users SET status = 'SUSPENDED' WHERE id = $1`, [adminId]);
  r = await admin.request('/api/v1/auth/me');
  check('suspension blocks an existing session', r.status === 403, `${r.status}`);
  const suspended = new Browser();
  await new Promise((res) => setTimeout(res, 31_000)); // per-number resend cooldown
  await suspended.start(5, 'ADMIN');
  r = await suspended.verify(5, CODE, 'ADMIN');
  check('suspended account refused even with the right code', r.status === 403 && r.json?.error?.code === 'ACCOUNT_SUSPENDED', JSON.stringify(r.json));

  // 7. mobile client (Bearer)
  const mobile = new Browser();
  await mobile.start(6);
  r = await mobile.verify(6, CODE, 'FARMER', { client: 'mobile' });
  const token = r.json?.data?.token;
  check('mobile login returns a Bearer token and sets no cookie', r.status === 200 && typeof token === 'string' && !mobile.cookies.has('cropai_session'), JSON.stringify(r.json));
  r = await new Browser().request('/api/v1/auth/me', { headers: { authorization: `Bearer ${token}` } });
  check('Bearer token authenticates /me', r.status === 200 && r.json?.data?.roles?.includes('FARMER'), `${r.status}`);

  // 8. CSRF / validation
  r = await new Browser().request('/api/v1/auth/otp/start', { method: 'POST', body: { phoneNumber: phone(7) }, headers: { origin: 'https://evil.example' } });
  check('cross-site request blocked', r.status === 403 && r.json?.error?.code === 'CROSS_SITE_REQUEST', JSON.stringify(r.json));
  r = await new Browser().request('/api/v1/auth/otp/start', { method: 'POST', body: { phoneNumber: '12345' } });
  check('invalid phone rejected', r.status === 422, `${r.status}`);

  // 9. logout
  r = await farmer.request('/api/v1/auth/logout', { method: 'POST', body: {} });
  check('logout succeeds and clears the cookie', r.status === 200 && !farmer.cookies.has('cropai_session'), `${r.status}`);
  r = await farmer.request('/api/v1/auth/me');
  check('after logout /me is 401', r.status === 401, `${r.status}`);

  await cleanup();
  await db.end();
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await db.end().catch(() => undefined);
  process.exitCode = 1;
});
