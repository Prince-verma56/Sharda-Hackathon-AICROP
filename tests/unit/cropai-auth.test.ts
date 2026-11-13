import { describe, expect, it } from 'vitest';
import { maskPhone, normalizeIndianMobile, normalizePhoneE164 } from '@/server/auth/phone';
import { can } from '@/server/auth/rbac';

describe('phone', () => {
  it('normalises Indian mobile numbers', () => {
    expect(normalizeIndianMobile('98765 43210')).toBe('+919876543210');
    expect(normalizeIndianMobile('+91-9876543210')).toBe('+919876543210');
    expect(normalizeIndianMobile('09876543210')).toBe('+919876543210');
    expect(normalizeIndianMobile('5876543210')).toBeNull();
  });

  it('accepts full E.164 for invitations (Clerk test numbers)', () => {
    expect(normalizePhoneE164('9876543210')).toBe('+919876543210');
    expect(normalizePhoneE164('+1 555 555 0100')).toBe('+15555550100');
    expect(normalizePhoneE164('12345')).toBeNull();
    expect(normalizePhoneE164('abc')).toBeNull();
  });

  it('masks phone numbers for staff screens', () => {
    expect(maskPhone('+919876543210')).toBe('+91 98•••••210');
    expect(maskPhone('+15555550100')).toBe('+15 •••••100');
    expect(maskPhone(null)).toBe('—');
  });
});

describe('RBAC', () => {
  it('enforces the admin permission matrix', () => {
    expect(can('SUPER_ADMIN', 'admins:manage')).toBe(true);
    expect(can('ADMIN', 'admins:manage')).toBe(false);
    expect(can('ADMIN', 'volunteers:manage')).toBe(true);
    expect(can('ADMIN', 'audit:view')).toBe(true);
    expect(can('AGRONOMIST', 'knowledge:approve')).toBe(true);
    expect(can('REVIEWER', 'knowledge:approve')).toBe(false);
    expect(can('REVIEWER', 'volunteers:manage')).toBe(false);
    expect(can('ANALYST', 'reviews:write')).toBe(false);
    expect(can(null, 'overview:view')).toBe(false);
  });
});
