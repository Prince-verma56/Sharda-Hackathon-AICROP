/** Shared pieces of the /api/v1/auth/* route handlers. */
import 'server-only';
import { z } from 'zod';
import type { Workspace } from '@/lib/auth/redirects';
import { fail } from '@/server/http/respond';
import { OTP_ERROR_MESSAGES, OtpError, otpErrorStatus } from './otp/errors';

export const REQUESTED_ROLE = z.enum(['FARMER', 'VOLUNTEER', 'ADMIN']).default('FARMER');
export const LANGUAGE = z.enum(['en', 'hi']).default('en');
export const PHONE_NUMBER = z.string().trim().min(8, 'Enter your mobile number.').max(20, 'Enter a valid mobile number.');

export function workspaceForRole(role: z.infer<typeof REQUESTED_ROLE>): Workspace {
  return role === 'ADMIN' ? 'admin' : role === 'VOLUNTEER' ? 'volunteer' : 'farmer';
}

/** OtpError -> API error envelope (never includes a code or the full phone number). */
export function otpFailure(error: unknown) {
  if (error instanceof OtpError) {
    return fail(error.code, otpErrorStatus(error.code), OTP_ERROR_MESSAGES[error.code], { ...error.details });
  }
  console.error('[auth] otp failure', (error as Error)?.message);
  return fail('OTP_PROVIDER_ERROR', 502, OTP_ERROR_MESSAGES.OTP_PROVIDER_ERROR);
}

export const DENIAL_MESSAGES = {
  ACCOUNT_SUSPENDED: 'This account has been suspended.',
  ACCOUNT_PENDING: 'This account is waiting for approval.',
  ACCOUNT_DISABLED: 'This account has been disabled.',
  VOLUNTEER_NOT_AUTHORISED: 'This number has no volunteer invitation yet. Ask your admin to invite this exact number, then sign in again.',
  ADMIN_NOT_AUTHORISED: 'This mobile number is not authorised for the admin workspace.',
} as const;
