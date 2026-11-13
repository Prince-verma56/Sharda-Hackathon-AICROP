/**
 * Shared helpers for the diagnosis route handlers (envelopes, rate limit, access).
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { rateLimiter } from '@/server/rate-limit';
import { ERROR_MESSAGES, InferenceClientError } from './client';

export function ok<T>(data: T, requestId: string, status = 200) {
  return NextResponse.json(
    { success: true, data, meta: { requestId, timestamp: new Date().toISOString() } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export function fail(code: string, status: number, requestId: string, message?: string) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message: message ?? ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INFERENCE_FAILED },
      meta: { requestId },
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export function failFromError(error: unknown, requestId: string) {
  if (error instanceof InferenceClientError) {
    return fail(error.code, error.status, requestId);
  }
  console.error(`[diagnosis] ${requestId} unexpected error`, error);
  return fail('INFERENCE_FAILED', 500, requestId);
}

function clientKey(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || 'local';
}

/** Returns an error response when the caller is over budget, otherwise null. */
export async function enforceRateLimit(req: Request, bucket: string, limit: number, requestId: string) {
  const result = await rateLimiter.check(`diagnosis:${bucket}:${clientKey(req)}`, limit, 60);
  if (result.allowed) return null;
  return fail('TOO_MANY_REQUESTS', 429, requestId, 'Too many requests. Wait a minute and retry.');
}

/**
 * Production requires a signed-in farmer or fully authenticated staff member so the model
 * cannot be used anonymously. Development stays open for the model lab.
 */
export async function enforceAccess(requestId: string) {
  if (process.env.NODE_ENV !== 'production') return null;
  try {
    const { getCurrentFarmer, getCurrentStaff } = await import('@/server/auth/dal');
    if ((await getCurrentFarmer()) || (await getCurrentStaff())) return null;
  } catch {
    // Session store unavailable: fail closed.
  }
  return fail('UNAUTHORIZED', 401, requestId, 'Sign in to use crop diagnosis.');
}
