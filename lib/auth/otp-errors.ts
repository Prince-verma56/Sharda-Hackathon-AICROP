/**
 * API error code (/api/v1/auth/otp/*) -> translated message key (lib/i18n/auth.ts).
 * Messages never reveal whether an account exists for a phone number.
 */
import type { OtpErrorKey } from '@/lib/i18n/auth';

const MAP: Record<string, OtpErrorKey> = {
  PHONE_INVALID: 'invalidPhone',
  VALIDATION_ERROR: 'invalidPhone',
  OTP_NUMBER_UNSUPPORTED: 'numberUnsupported',
  OTP_INVALID: 'wrongCode',
  OTP_EXPIRED: 'expired',
  OTP_LOCKED: 'locked',
  OTP_COOLDOWN: 'cooldown',
  OTP_RATE_LIMITED: 'tooMany',
  TOO_MANY_REQUESTS: 'tooMany',
  OTP_NOT_CONFIGURED: 'notConfigured',
  OTP_DEV_LOCALHOST_ONLY: 'devLocalOnly',
  OTP_PHONE_NOT_ALLOWED: 'devPhoneNotAllowed',
  OTP_RECIPIENT_NOT_ALLOWED: 'recipientNotAllowed',
  OTP_COUNTRY_BLOCKED: 'countryBlocked',
  OTP_DELIVERY_BLOCKED: 'deliveryBlocked',
  OTP_PROVIDER_ERROR: 'providerError',
  VOLUNTEER_NOT_AUTHORISED: 'volunteerDenied',
  ADMIN_NOT_AUTHORISED: 'adminDenied',
  ACCOUNT_SUSPENDED: 'accountSuspended',
  ACCOUNT_PENDING: 'accountPending',
  ACCOUNT_DISABLED: 'accountDisabled',
  NETWORK: 'network',
};

export function otpErrorKey(code: string | null | undefined): OtpErrorKey {
  return (code && MAP[code]) || 'generic';
}
