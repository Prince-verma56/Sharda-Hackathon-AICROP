import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { brand } from '@/config/brand';
import { continueUrl, firstParam, parseWorkspace, safeNextPath } from '@/lib/auth/redirects';
import { authLang } from '@/lib/i18n/auth';
import { getIdentity } from '@/server/auth/dal';
import { configuredOtpProvider, twilioVerifyConfig } from '@/server/auth/otp/config';
import { LoginExperience } from './login-experience';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata: Metadata = { title: `Login · ${brand.name}`, robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Development-only hints about missing OTP configuration (never shown in production). */
function setupIssues(): string[] {
  const provider = configuredOtpProvider();
  if (!provider) return ['AUTH_OTP_PROVIDER is not set. Use "dev" (free, localhost only) or "twilio_verify" (real SMS).'];
  if (provider === 'twilio_verify' && !twilioVerifyConfig()) {
    return ['Twilio Verify is selected but TWILIO_ACCOUNT_SID (AC…), TWILIO_AUTH_TOKEN or TWILIO_VERIFY_SERVICE_SID (VA…) is missing.'];
  }
  return [];
}

/**
 * One login for farmers, volunteers and administrators: mobile number + OTP on our own domain.
 * `?role=` selects the tab (a request, never a grant); `?next=` is an allowlisted in-app path.
 * Signed-in visitors skip the form and are routed by /auth/continue.
 */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requested = parseWorkspace(firstParam(params.role));
  const next = safeNextPath(firstParam(params.next));

  const identity = await getIdentity();
  if (identity.state === 'ok') redirect(continueUrl({ role: requested, next }));

  const lang = authLang((await cookies()).get('cropai_lang')?.value);
  const development = process.env.NODE_ENV !== 'production';

  return (
    <div className={`theme-crop ${manrope.variable} flex min-h-dvh flex-1 flex-col font-[family-name:var(--font-manrope)]`}>
      <LoginExperience
        initialRole={requested ?? 'farmer'}
        roleFromUrl={requested !== null}
        initialLang={lang}
        next={next}
        setupIssues={development ? setupIssues() : []}
        devMode={development && configuredOtpProvider() === 'dev'}
      />
    </div>
  );
}
