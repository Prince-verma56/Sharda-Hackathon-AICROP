import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { rateLimiter } from '@/server/rate-limit';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(code: string, status: number, message: string, details?: Record<string, unknown>) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details ? { details } : {}) } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Best-effort client identifier for rate limiting (never stored with user data). */
export function clientKey(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<{ data: T } | { error: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: fail('INVALID_JSON', 400, 'Request body must be JSON.') };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { error: fail('VALIDATION_ERROR', 422, parsed.error.issues[0]?.message ?? 'Invalid request.') };
  }
  return { data: parsed.data };
}

export async function limit(req: Request, bucket: string, max: number, windowSeconds = 60) {
  const result = await rateLimiter.check(`${bucket}:${clientKey(req)}`, max, windowSeconds);
  return result.allowed ? null : fail('TOO_MANY_REQUESTS', 429, 'Too many requests. Please wait and try again.');
}

/**
 * CSRF guard for cookie-authenticated, state-changing JSON endpoints: the body must be JSON
 * (cross-site HTML forms cannot send application/json without a CORS preflight) and a browser
 * Origin header, when present, must match this host. Native apps send no Origin and use Bearer tokens.
 */
export function rejectCrossSite(req: Request) {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return fail('UNSUPPORTED_MEDIA_TYPE', 415, 'Send the request as application/json.');
  }
  const origin = req.headers.get('origin');
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (!originHost || originHost !== host) return fail('CROSS_SITE_REQUEST', 403, 'Cross-site request blocked.');
  }
  return null;
}
