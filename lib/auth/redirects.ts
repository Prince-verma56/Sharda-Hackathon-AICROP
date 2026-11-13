/**
 * Login entry points and safe post-login destinations — shared by proxy.ts, pages and client code.
 *
 * A role in a URL (`?role=admin`) or a login tab is only a REQUEST for a workspace. It never
 * grants anything: the database decides which workspaces an account has (server/auth/dal.ts).
 * `next` is accepted only as a relative, allowlisted in-app path (no open redirects).
 */

export type Workspace = 'farmer' | 'volunteer' | 'admin';

export const WORKSPACES: readonly Workspace[] = ['farmer', 'volunteer', 'admin'];

export const WORKSPACE_HOME: Record<Workspace, string> = { farmer: '/farmer', volunteer: '/volunteer', admin: '/admin' };

/** First path segment -> workspace that owns it. `/dev/*` tools are for administrators. */
const PATH_ROOTS: Readonly<Record<string, Workspace>> = { farmer: 'farmer', volunteer: 'volunteer', admin: 'admin', dev: 'admin' };

/** Letters, digits, `-`, `_` and `/` only: no scheme, host, query, hash, dots, backslashes or encodings. */
const SAFE_PATH = /^\/[A-Za-z0-9\-_/]{1,199}$/;

export function parseWorkspace(value: unknown): Workspace | null {
  return typeof value === 'string' && (WORKSPACES as readonly string[]).includes(value) ? (value as Workspace) : null;
}

/** The workspace an in-app path belongs to, or null for public/unknown paths. */
export function workspaceForPath(path: string): Workspace | null {
  const root = path.split('/')[1] ?? '';
  return Object.hasOwn(PATH_ROOTS, root) ? PATH_ROOTS[root] : null;
}

/** Returns a safe relative path inside a workspace, or null. Rejects `//host`, `/\host`, `https:`, `..`, etc. */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!SAFE_PATH.test(path) || path.includes('//')) return null;
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return workspaceForPath(trimmed) ? trimmed : null;
}

function withQuery(base: string, role: Workspace | null | undefined, next: string | null | undefined): string {
  const parts: string[] = [];
  if (role) parts.push(`role=${role}`);
  const safe = safeNextPath(next);
  // SAFE_PATH characters never need percent-encoding, so the URL stays readable: ?next=/farmer/scan
  if (safe) parts.push(`next=${safe}`);
  return parts.length ? `${base}?${parts.join('&')}` : base;
}

/** e.g. `/login?role=farmer&next=/farmer/scan` */
export function loginUrl(opts: { role?: Workspace | null; next?: string | null } = {}): string {
  return withQuery('/login', opts.role, opts.next);
}

/** Post-verification router: `/auth/continue?role=admin&next=/admin/diagnoses` */
export function continueUrl(opts: { role?: Workspace | null; next?: string | null } = {}): string {
  return withQuery('/auth/continue', opts.role, opts.next);
}

/** Login URL for a signed-out request to a protected page (used by proxy.ts). */
export function loginUrlForProtectedPath(pathname: string): string {
  const next = safeNextPath(pathname);
  return loginUrl({ role: next ? workspaceForPath(next) : null, next });
}

/**
 * Workspaces for a set of database roles. A suspended volunteer profile removes the volunteer
 * workspace. (Server code passes roles read from PostgreSQL — never from the browser.)
 */
export function workspacesForRoles(roles: readonly string[], volunteerStatus: string | null): Workspace[] {
  const list: Workspace[] = [];
  if (roles.includes('FARMER')) list.push('farmer');
  if (roles.includes('VOLUNTEER') && volunteerStatus !== 'SUSPENDED') list.push('volunteer');
  if (roles.includes('ADMIN') || roles.includes('SUPER_ADMIN')) list.push('admin');
  return list;
}

export type Destination =
  | { kind: 'redirect'; to: string; workspace: Workspace }
  /** several workspaces and nothing specific requested -> workspace chooser */
  | { kind: 'choose' }
  /** the requested workspace is not assigned to this account */
  | { kind: 'denied'; requested: Workspace }
  /** the account has no workspace at all */
  | { kind: 'none' };

/**
 * Decides where a verified user goes. `available` must come from the database (server-side);
 * `requested` (login tab / ?role) and `next` are untrusted hints and can only narrow the choice.
 */
export function resolveDestination(
  available: readonly Workspace[],
  requested: Workspace | null,
  next: string | null,
  /** default for accounts with several workspaces when nothing was requested (e.g. owners -> admin) */
  preferred: Workspace | null = null,
): Destination {
  const safeNext = safeNextPath(next);
  const nextSpace = safeNext ? workspaceForPath(safeNext) : null;
  // "Farmer" is the default login tab. For staff without a farmer workspace it means "no
  // preference" — unless they were heading to a farmer page (then the farmer rules apply).
  const preference = requested === 'farmer' && !available.includes('farmer') && !nextSpace && available.length > 0 ? null : requested;
  const target = preference ?? nextSpace;
  if (target) {
    if (!available.includes(target)) return { kind: 'denied', requested: target };
    return { kind: 'redirect', to: safeNext && nextSpace === target ? safeNext : WORKSPACE_HOME[target], workspace: target };
  }
  if (available.length === 1) return { kind: 'redirect', to: WORKSPACE_HOME[available[0]], workspace: available[0] };
  if (preferred && available.includes(preferred)) return { kind: 'redirect', to: WORKSPACE_HOME[preferred], workspace: preferred };
  return available.length > 1 ? { kind: 'choose' } : { kind: 'none' };
}

/** First value of a Next.js searchParams entry. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
