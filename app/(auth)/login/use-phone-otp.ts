'use client';

/**
 * Phone-OTP engine shared by all three login tabs. Talks only to our own API:
 *   POST /api/v1/auth/otp/start   -> provider sends the OTP (Twilio Verify) or dev mode (no SMS)
 *   POST /api/v1/auth/otp/verify  -> provider approves the code -> server resolves roles -> session cookie
 * The browser never sees an OTP, a provider credential or a session token (HttpOnly cookie).
 */
import { useEffect, useState } from 'react';
import { otpErrorKey } from '@/lib/auth/otp-errors';
import type { Workspace } from '@/lib/auth/redirects';
import type { Lang, OtpErrorKey } from '@/lib/i18n/auth';

export type OtpStep = 'phone' | 'code' | 'done';

export interface OtpUiError {
  key: OtpErrorKey;
  attemptsLeft?: number;
  /** provider/API code, shown only in development builds */
  debug?: string;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: { retryAfterSeconds?: number; attemptsLeft?: number; providerCode?: number } };
}

const ROLE: Record<Workspace, 'FARMER' | 'VOLUNTEER' | 'ADMIN'> = { farmer: 'FARMER', volunteer: 'VOLUNTEER', admin: 'ADMIN' };

async function post<T>(path: string, body: unknown): Promise<Envelope<T>> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    return (await response.json()) as Envelope<T>;
  } catch {
    return { success: false, error: { code: 'NETWORK', message: 'Network error' } };
  }
}

export function usePhoneOtp() {
  const [step, setStep] = useState<OtpStep>('phone');
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OtpUiError | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [delivery, setDelivery] = useState<'sms' | 'development' | null>(null);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  function fail(envelope: Envelope<unknown>) {
    const details = envelope.error?.details;
    setError({
      key: otpErrorKey(envelope.error?.code),
      attemptsLeft: details?.attemptsLeft,
      debug:
        process.env.NODE_ENV !== 'production'
          ? [envelope.error?.code, details?.providerCode ? `provider ${details.providerCode}` : null].filter(Boolean).join(' · ')
          : undefined,
    });
    if (details?.retryAfterSeconds && envelope.error?.code === 'OTP_COOLDOWN') setCooldown(details.retryAfterSeconds);
  }

  async function start(e164: string, role: Workspace, lang: Lang): Promise<boolean> {
    setBusy(true);
    setError(null);
    const result = await post<{ resendAfterSeconds: number; delivery: 'sms' | 'development' }>('/api/v1/auth/otp/start', {
      phoneNumber: e164,
      requestedRole: ROLE[role],
      language: lang,
    });
    setBusy(false);
    if (!result.success || !result.data) {
      fail(result);
      return false;
    }
    setPhone(e164);
    setDelivery(result.data.delivery);
    setStep('code');
    setCooldown(result.data.resendAfterSeconds);
    setSentCount((n) => n + 1);
    return true;
  }

  /** Sends the OTP for a number (step 1). */
  const requestCode = (e164: string, role: Workspace, lang: Lang) => start(e164, role, lang);

  /** Sends a new OTP to the same number after the cooldown. */
  async function resend(role: Workspace, lang: Lang): Promise<void> {
    if (!phone || cooldown > 0 || busy) return;
    await start(phone, role, lang);
  }

  /** Verifies the code; on success the session cookie is set and `true` is returned. */
  async function verify(code: string, role: Workspace, lang: Lang): Promise<boolean> {
    if (!phone || !/^\d{6}$/.test(code) || busy) return false;
    setBusy(true);
    setError(null);
    const result = await post<{ workspaces: Workspace[] }>('/api/v1/auth/otp/verify', {
      phoneNumber: phone,
      code,
      requestedRole: ROLE[role],
      language: lang,
    });
    setBusy(false);
    if (!result.success) {
      fail(result);
      // the verification is used up / denied: a fresh OTP is required
      if (['OTP_EXPIRED', 'OTP_LOCKED'].includes(result.error?.code ?? '')) setCooldown(0);
      return false;
    }
    setStep('done');
    return true;
  }

  /** "Change mobile number": back to step 1 (nothing is sent). */
  function reset() {
    setStep('phone');
    setPhone(null);
    setError(null);
    setDelivery(null);
  }

  return { step, phone, busy, error, cooldown, delivery, sentCount, requestCode, resend, verify, reset, clearError: () => setError(null) };
}
