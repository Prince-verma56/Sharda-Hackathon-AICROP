/** OTP failures. Codes are stable API error codes; messages are translated on the client. */
export type OtpErrorCode =
  /** another OTP was requested less than the cooldown ago */
  | 'OTP_COOLDOWN'
  /** too many OTP requests / checks (per phone, per IP or provider limit) */
  | 'OTP_RATE_LIMITED'
  /** no active verification for this number (expired, already used or never started) */
  | 'OTP_EXPIRED'
  /** wrong code */
  | 'OTP_INVALID'
  /** too many wrong codes — a new OTP is required */
  | 'OTP_LOCKED'
  /** AUTH_OTP_PROVIDER missing / provider credentials missing or rejected */
  | 'OTP_NOT_CONFIGURED'
  /** development provider used from a non-localhost address */
  | 'OTP_DEV_LOCALHOST_ONLY'
  /** development provider: number not in AUTH_DEV_OTP_PHONES */
  | 'OTP_PHONE_NOT_ALLOWED'
  /** provider trial account: recipient is not a verified number */
  | 'OTP_RECIPIENT_NOT_ALLOWED'
  /** SMS to this country/region is not enabled (geo permissions) */
  | 'OTP_COUNTRY_BLOCKED'
  /** provider says the number is invalid, a landline or cannot receive SMS */
  | 'OTP_NUMBER_UNSUPPORTED'
  /** provider fraud protection blocked delivery */
  | 'OTP_DELIVERY_BLOCKED'
  /** unexpected provider failure (no automatic retry, to avoid duplicate SMS charges) */
  | 'OTP_PROVIDER_ERROR';

export interface OtpErrorDetails {
  retryAfterSeconds?: number;
  attemptsLeft?: number;
  /** provider error code (e.g. Twilio 21608) — exact reason for configuration errors */
  providerCode?: number;
}

export class OtpError extends Error {
  constructor(
    public readonly code: OtpErrorCode,
    public readonly details: OtpErrorDetails = {},
  ) {
    super(code);
    this.name = 'OtpError';
  }
}

/** HTTP status for an OTP error code. */
export function otpErrorStatus(code: OtpErrorCode): number {
  switch (code) {
    case 'OTP_COOLDOWN':
    case 'OTP_RATE_LIMITED':
      return 429;
    case 'OTP_NOT_CONFIGURED':
      return 503;
    case 'OTP_PROVIDER_ERROR':
      return 502;
    case 'OTP_DEV_LOCALHOST_ONLY':
    case 'OTP_PHONE_NOT_ALLOWED':
    case 'OTP_RECIPIENT_NOT_ALLOWED':
    case 'OTP_COUNTRY_BLOCKED':
    case 'OTP_DELIVERY_BLOCKED':
      return 403;
    case 'OTP_NUMBER_UNSUPPORTED':
      return 422;
    default:
      return 401;
  }
}

/** English fallback messages for API clients (the web UI shows its own translations). */
export const OTP_ERROR_MESSAGES: Record<OtpErrorCode, string> = {
  OTP_COOLDOWN: 'Please wait before requesting another OTP.',
  OTP_RATE_LIMITED: 'Too many OTP attempts. Please try again later.',
  OTP_EXPIRED: 'This OTP has expired or was already used. Request a new one.',
  OTP_INVALID: 'The OTP is not correct.',
  OTP_LOCKED: 'Too many wrong attempts. Request a new OTP.',
  OTP_NOT_CONFIGURED: 'OTP login is not configured on this server.',
  OTP_DEV_LOCALHOST_ONLY: 'Development OTP mode only works on localhost.',
  OTP_PHONE_NOT_ALLOWED: 'This number is not in the development test-number list.',
  OTP_RECIPIENT_NOT_ALLOWED: 'The SMS provider cannot send to this number yet (trial accounts only send to verified numbers).',
  OTP_COUNTRY_BLOCKED: 'SMS delivery to this country is not enabled for our SMS provider.',
  OTP_NUMBER_UNSUPPORTED: 'This number cannot receive SMS. Use a mobile number.',
  OTP_DELIVERY_BLOCKED: 'The SMS provider blocked delivery to this number.',
  OTP_PROVIDER_ERROR: 'The SMS service is temporarily unavailable. Please try again.',
};
