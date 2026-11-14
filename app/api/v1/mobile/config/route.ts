/**
 * GET /api/v1/mobile/config — public bootstrap for the Flutter app (no sign-in).
 * Only public, non-secret facts: brand names, which OTP mode is active (never a code), whether the
 * voice assistant is configured, feature flags the app adapts to, and legal page paths.
 */
import { brand } from '@/config/brand';
import { contactEmail } from '@/components/marketing/legal/content';
import { configuredOtpProvider } from '@/server/auth/otp/config';
import { limit, ok } from '@/server/http/respond';

export async function GET(req: Request) {
  const limited = await limit(req, 'mobile-config', 60);
  if (limited) return limited;
  const otp = configuredOtpProvider();
  return ok({
    apiVersion: 1,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    brand: { name: brand.name, assistantName: brand.assistantName },
    auth: { otpMode: otp === 'twilio_verify' ? 'sms' : otp === 'dev' ? 'development' : 'not_configured', otpLength: 6, accessTokenMinutes: 15 },
    voice: { available: Boolean(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY), provider: 'vapi' },
    features: { autoCrop: true, heatmap: false, offlineDiagnosis: false },
    links: { privacyPolicy: '/privacy-policy', terms: '/terms-and-conditions', dataRights: '/data-rights', resources: '/resources' },
    support: { email: contactEmail(), kisanCallCentre: { display: '1800-180-1551', tel: '18001801551' } },
  });
}
