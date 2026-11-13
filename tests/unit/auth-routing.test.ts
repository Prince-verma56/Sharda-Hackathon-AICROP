/**
 * Login routing and access rules without a database: safe `next` paths (no open redirects),
 * role tabs that never grant access, workspace resolution, error-message mapping, CSRF guard,
 * and complete English/Hindi login translations.
 */
import { describe, expect, it } from 'vitest';
import { otpErrorKey } from '@/lib/auth/otp-errors';
import {
  continueUrl,
  loginUrl,
  loginUrlForProtectedPath,
  parseWorkspace,
  resolveDestination,
  safeNextPath,
  workspaceForPath,
  workspacesForRoles,
} from '@/lib/auth/redirects';
import { AUTH_TEXT, authLang } from '@/lib/i18n/auth';
import { rejectCrossSite } from '@/server/http/respond';

describe('safe next paths', () => {
  it('accepts in-app workspace paths', () => {
    expect(safeNextPath('/farmer/scan')).toBe('/farmer/scan');
    expect(safeNextPath('/farmer/diagnosis/clx123_ab-c')).toBe('/farmer/diagnosis/clx123_ab-c');
    expect(safeNextPath('/admin/')).toBe('/admin');
    expect(safeNextPath('/dev/model-lab')).toBe('/dev/model-lab');
  });

  it('rejects external, protocol-relative, encoded and non-workspace targets', () => {
    for (const bad of [
      'https://evil.example/farmer',
      '//evil.example',
      '/\\evil.example',
      '/farmer//evil',
      '/farmer/../admin',
      '/farmer?x=https://evil',
      '/farmer#x',
      '/farmer%2F..%2Fadmin',
      'javascript:alert(1)',
      '/login',
      '/',
      '/api/v1/auth/me',
      '/constructor',
      '',
      null,
      42,
    ]) {
      expect(safeNextPath(bad), String(bad)).toBeNull();
    }
  });

  it('maps paths to workspaces', () => {
    expect(workspaceForPath('/farmer/scan')).toBe('farmer');
    expect(workspaceForPath('/volunteer')).toBe('volunteer');
    expect(workspaceForPath('/dev/model-lab')).toBe('admin');
    expect(workspaceForPath('/about')).toBeNull();
  });
});

describe('login URLs', () => {
  it('are short and readable', () => {
    expect(loginUrl({ role: 'farmer', next: '/farmer/scan' })).toBe('/login?role=farmer&next=/farmer/scan');
    expect(loginUrl()).toBe('/login');
    expect(continueUrl({ role: 'admin' })).toBe('/auth/continue?role=admin');
    expect(loginUrl({ role: 'farmer', next: 'https://evil.example' })).toBe('/login?role=farmer');
  });

  it('protected paths send signed-out users to /login with role and destination', () => {
    expect(loginUrlForProtectedPath('/farmer/scan')).toBe('/login?role=farmer&next=/farmer/scan');
    expect(loginUrlForProtectedPath('/admin')).toBe('/login?role=admin&next=/admin');
    expect(loginUrlForProtectedPath('/volunteer/profile')).toBe('/login?role=volunteer&next=/volunteer/profile');
    expect(loginUrlForProtectedPath('/dev/model-lab')).toBe('/login?role=admin&next=/dev/model-lab');
    expect(loginUrlForProtectedPath('/workspaces')).toBe('/login');
  });

  it('only known roles are accepted from the URL', () => {
    expect(parseWorkspace('admin')).toBe('admin');
    expect(parseWorkspace('ADMIN')).toBeNull();
    expect(parseWorkspace('super_admin')).toBeNull();
  });
});

describe('workspace resolution (tab = request, database = permission)', () => {
  it('derives workspaces from database roles only', () => {
    expect(workspacesForRoles(['FARMER'], null)).toEqual(['farmer']);
    expect(workspacesForRoles(['FARMER', 'VOLUNTEER'], 'PENDING')).toEqual(['farmer', 'volunteer']);
    expect(workspacesForRoles(['VOLUNTEER'], 'SUSPENDED')).toEqual([]);
    expect(workspacesForRoles(['SUPER_ADMIN'], null)).toEqual(['admin']);
  });

  it('denies a requested workspace the account does not have', () => {
    expect(resolveDestination(['farmer'], 'admin', null)).toEqual({ kind: 'denied', requested: 'admin' });
    expect(resolveDestination(['farmer'], 'volunteer', null)).toEqual({ kind: 'denied', requested: 'volunteer' });
  });

  it('honours a safe next path inside the permitted workspace', () => {
    expect(resolveDestination(['farmer'], 'farmer', '/farmer/scan')).toEqual({ kind: 'redirect', to: '/farmer/scan', workspace: 'farmer' });
    expect(resolveDestination(['admin'], 'admin', '/dev/model-lab')).toEqual({ kind: 'redirect', to: '/dev/model-lab', workspace: 'admin' });
    expect(resolveDestination(['admin'], 'admin', '/farmer/scan')).toEqual({ kind: 'redirect', to: '/admin', workspace: 'admin' });
  });

  it('treats the default Farmer tab as "no preference" for staff, unless a farmer page was requested', () => {
    expect(resolveDestination(['admin'], 'farmer', null)).toEqual({ kind: 'redirect', to: '/admin', workspace: 'admin' });
    expect(resolveDestination(['admin', 'volunteer'], 'farmer', null)).toEqual({ kind: 'choose' });
    expect(resolveDestination(['admin'], 'farmer', '/farmer/scan')).toEqual({ kind: 'denied', requested: 'farmer' });
  });

  it('routes single, multiple and zero workspaces', () => {
    expect(resolveDestination(['volunteer'], null, null)).toEqual({ kind: 'redirect', to: '/volunteer', workspace: 'volunteer' });
    expect(resolveDestination(['farmer', 'admin'], null, null)).toEqual({ kind: 'choose' });
    expect(resolveDestination([], null, null)).toEqual({ kind: 'none' });
  });
});

describe('error messages and CSRF guard', () => {
  it('maps API codes to translated messages without account hints', () => {
    expect(otpErrorKey('OTP_INVALID')).toBe('wrongCode');
    expect(otpErrorKey('OTP_RECIPIENT_NOT_ALLOWED')).toBe('recipientNotAllowed');
    expect(otpErrorKey('ADMIN_NOT_AUTHORISED')).toBe('adminDenied');
    expect(otpErrorKey('SOMETHING_NEW')).toBe('generic');
    expect(otpErrorKey(undefined)).toBe('generic');
  });

  it('blocks cross-site and non-JSON state-changing requests', () => {
    const req = (headers: Record<string, string>) => new Request('http://localhost:3000/api/v1/auth/otp/start', { method: 'POST', headers });
    expect(rejectCrossSite(req({ 'content-type': 'application/json', host: 'localhost:3000', origin: 'http://localhost:3000' }))).toBeNull();
    expect(rejectCrossSite(req({ 'content-type': 'application/json', host: 'localhost:3000' }))).toBeNull(); // native app: no Origin
    expect(rejectCrossSite(req({ 'content-type': 'application/json', host: 'localhost:3000', origin: 'https://evil.example' }))?.status).toBe(403);
    expect(rejectCrossSite(req({ 'content-type': 'text/plain', host: 'localhost:3000' }))?.status).toBe(415);
  });
});

describe('English / Hindi login text', () => {
  const keys = (value: unknown, prefix = ''): string[] =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
      : [prefix.slice(0, -1)];

  it('defaults to English and has the same keys in both languages', () => {
    expect(authLang(undefined)).toBe('en');
    expect(authLang('hi')).toBe('hi');
    expect(keys(AUTH_TEXT.hi).sort()).toEqual(keys(AUTH_TEXT.en).sort());
  });

  it('has no empty strings and translates the role tabs', () => {
    const strings = (value: unknown): string[] =>
      typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
    for (const lang of ['en', 'hi'] as const) for (const s of strings(AUTH_TEXT[lang])) expect(s.trim().length).toBeGreaterThan(0);
    expect([AUTH_TEXT.hi.roles.farmer.tab, AUTH_TEXT.hi.roles.volunteer.tab, AUTH_TEXT.hi.roles.admin.tab]).toEqual(['किसान', 'स्वयंसेवक', 'प्रशासक']);
    expect(AUTH_TEXT.hi.sendOtp).toBe('OTP भेजें');
    expect(AUTH_TEXT.hi.verify).toBe('OTP सत्यापित करें');
  });
});
