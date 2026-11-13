/** Server-side permission matrix for staff. Navigation hiding is cosmetic; this is the rule. */
export type StaffRoleName = 'SUPER_ADMIN' | 'AGRONOMIST' | 'REVIEWER' | 'ANALYST';

export type Permission =
  | 'overview:view'
  | 'farmers:view'
  | 'farmers:manage'
  | 'diagnoses:view'
  | 'reviews:write'
  | 'knowledge:view'
  | 'knowledge:edit'
  | 'knowledge:approve'
  | 'crops:view'
  | 'analytics:view'
  | 'audit:view'
  | 'settings:manage'
  | 'staff:manage'
  | 'research:use';

const ROLE_PERMISSIONS: Record<StaffRoleName, readonly Permission[]> = {
  SUPER_ADMIN: [
    'overview:view', 'farmers:view', 'farmers:manage', 'diagnoses:view', 'reviews:write', 'knowledge:view',
    'knowledge:edit', 'knowledge:approve', 'crops:view', 'analytics:view', 'audit:view', 'settings:manage',
    'staff:manage', 'research:use',
  ],
  AGRONOMIST: [
    'overview:view', 'farmers:view', 'diagnoses:view', 'reviews:write', 'knowledge:view', 'knowledge:edit',
    'knowledge:approve', 'crops:view', 'analytics:view', 'research:use',
  ],
  REVIEWER: ['overview:view', 'diagnoses:view', 'reviews:write', 'knowledge:view', 'knowledge:edit', 'crops:view', 'research:use'],
  ANALYST: ['overview:view', 'diagnoses:view', 'knowledge:view', 'crops:view', 'analytics:view'],
};

export function can(role: StaffRoleName | null | undefined, permission: Permission): boolean {
  return Boolean(role && ROLE_PERMISSIONS[role]?.includes(permission));
}

export function permissionsFor(role: StaffRoleName): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export const ROLE_LABELS: Record<StaffRoleName, string> = {
  SUPER_ADMIN: 'Super admin',
  AGRONOMIST: 'Agronomist',
  REVIEWER: 'Reviewer',
  ANALYST: 'Analyst',
};
