/**
 * Small crypto helpers (node:crypto). Authentication itself is handled by Clerk — no passwords,
 * OTP codes or TOTP secrets are stored or verified by CropAI.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Keyed hash (e.g. signed voice-session tokens). */
export function hmac(value: string): string {
  return createHmac('sha256', authSecret()).update(value).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET must be set to at least 32 characters');
  return secret;
}
