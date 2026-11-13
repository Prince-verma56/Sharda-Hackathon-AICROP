'use client';

/**
 * CropAI login (/login): three role tabs, English/Hindi, phone + OTP only (our own API:
 * Twilio Verify for real SMS, or the free localhost development provider).
 * The tab only chooses where to go after verification; the server decides what is allowed.
 */
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { ArrowLeft, ArrowRight, Check, FlaskConical, HandHeart, Info, Languages, Loader2, ShieldCheck, Sprout, TriangleAlert } from 'lucide-react';
import { LeafMark } from '@/components/marketing/home/brand';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { continueUrl, loginUrl, parseWorkspace, WORKSPACES, type Workspace } from '@/lib/auth/redirects';
import { authText, type Lang } from '@/lib/i18n/auth';
import { saveLangCookie } from '@/lib/i18n/lang-cookie';
import { cn } from '@/lib/utils';
import { usePhoneOtp } from './use-phone-otp';

const ROLE_ICONS = { farmer: Sprout, volunteer: HandHeart, admin: ShieldCheck } as const;

/** Indian mobile (10 digits starting 6-9, optional 0/+91 prefix) or any E.164 number. */
function toE164(country: 'in' | 'other', raw: string): string | null {
  const compact = raw.replace(/[\s\-().]/g, '');
  if (country === 'in') {
    const match = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(compact);
    return match ? `+91${match[1]}` : null;
  }
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

function prettyPhone(e164: string): string {
  return e164.startsWith('+91') && e164.length === 13 ? `+91 ${e164.slice(3, 8)} ${e164.slice(8)}` : e164;
}

export interface LoginExperienceProps {
  initialRole: Workspace;
  /** true when the role came from the URL (?role=…) rather than the default tab */
  roleFromUrl: boolean;
  initialLang: Lang;
  next: string | null;
  /** Development only: server configuration problems (e.g. AUTH_OTP_PROVIDER missing). */
  setupIssues: string[];
  /** The free development OTP provider is active (no SMS is sent). */
  devMode: boolean;
}

export function LoginExperience({ initialRole, roleFromUrl, initialLang, next, setupIssues, devMode }: LoginExperienceProps) {
  const router = useRouter();
  const otp = usePhoneOtp();
  const [lang, setLang] = useState<Lang>(initialLang);
  const [role, setRole] = useState<Workspace>(initialRole);
  // The default Farmer tab is not a choice: then the server picks the account's default workspace.
  const [roleChosen, setRoleChosen] = useState(roleFromUrl);
  const [country, setCountry] = useState<'in' | 'other'>('in');
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [invalidPhone, setInvalidPhone] = useState(false);
  const t = authText(lang);
  const destination = continueUrl({ role: roleChosen ? role : null, next });

  function chooseLang(value: Lang) {
    setLang(value);
    saveLangCookie(value);
  }

  function chooseRole(value: unknown) {
    const nextRole = parseWorkspace(value);
    if (!nextRole || nextRole === role) return;
    setRole(nextRole);
    setRoleChosen(true);
    setInvalidPhone(false);
    otp.clearError();
    // keep the address bar meaningful and shareable: /login?role=volunteer
    window.history.replaceState(null, '', loginUrl({ role: nextRole, next }));
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    const e164 = toE164(country, number);
    setInvalidPhone(!e164);
    if (!e164) return;
    setCode('');
    await otp.requestCode(e164, role, lang);
  }

  async function verify(value: string) {
    const ok = await otp.verify(value, role, lang);
    if (ok) {
      router.replace(destination);
      router.refresh();
    } else {
      setCode('');
    }
  }

  function changeNumber() {
    setCode('');
    otp.reset();
  }

  const errorKey = invalidPhone ? 'invalidPhone' : otp.error?.key;

  return (
    <div lang={lang} className="grid min-h-dvh grid-cols-1 overflow-x-clip bg-[var(--crop-cream)] text-foreground lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Desktop: agricultural imagery and product introduction */}
      <aside className="relative hidden overflow-hidden lg:block">
        <Image src="/images/home/hero.jpg" alt="" fill fetchPriority="high" sizes="52vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#14230f]/95 via-[#14230f]/45 to-[#14230f]/25" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white xl:p-14">
          <Link href="/" className="flex w-fit items-center gap-2 text-xl font-bold tracking-tight">
            <LeafMark className="text-[var(--crop-green-200)]" /> CropAI
          </Link>
          <div>
            <h2 className="max-w-lg text-[clamp(2.2rem,3.4vw,3.4rem)] leading-[1.02] font-semibold tracking-[-0.03em]">{t.heroTitle}</h2>
            <ul className="mt-8 flex flex-col gap-3 text-base text-white/90">
              {t.heroPoints.map((point) => (
                <li key={point} className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur"><Check className="size-4" /></span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <p className="flex max-w-md items-center gap-2 text-sm text-white/75"><ShieldCheck className="size-4 shrink-0" /> {t.secured}</p>
        </div>
      </aside>

      {/* Authentication */}
      <main className="flex min-h-dvh min-w-0 flex-col px-4 py-5 sm:px-8 lg:px-12 xl:px-16">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight lg:hidden">
            <LeafMark className="size-6 text-[var(--crop-green-600)]" /> CropAI
          </Link>
          <Link href="/" className="hidden items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground lg:flex">
            <ArrowLeft className="size-4" /> {t.backHome}
          </Link>
          <div role="group" aria-label={t.languageLabel} className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-border">
            <Languages aria-hidden className="ml-2 size-4 text-[var(--crop-green-600)]" />
            {(['en', 'hi'] as const).map((value) => (
              <button
                key={value}
                type="button"
                lang={value}
                onClick={() => chooseLang(value)}
                aria-pressed={lang === value}
                className={cn(
                  'min-h-9 rounded-full px-3.5 text-sm font-semibold transition-colors',
                  lang === value ? 'bg-[var(--crop-green-800)] text-white' : 'text-foreground/70 hover:text-foreground',
                )}
              >
                {value === 'en' ? 'English' : 'हिंदी'}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <Tabs value={role} onValueChange={chooseRole} className="gap-0">
            <TabsList
              aria-label={t.roleGroupLabel}
              className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl bg-[#e9eadf] p-1 group-data-horizontal/tabs:h-auto"
            >
              {WORKSPACES.map((value) => {
                const Icon = ROLE_ICONS[value];
                return (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="h-auto min-h-14 flex-col gap-1 rounded-xl py-2 text-[13px] font-semibold text-foreground/65 data-active:bg-white data-active:text-[var(--crop-green-900)] data-active:shadow-sm sm:text-sm"
                  >
                    <Icon className="size-5" />
                    {t.roles[value].tab}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {WORKSPACES.map((value) => (
              <TabsContent key={value} value={value} className="mt-7 flex flex-col">
                {otp.step === 'phone' ? (
                  <>
                    <h1 className="text-[1.7rem] leading-tight font-semibold tracking-tight sm:text-3xl">{t.roles[value].title}</h1>
                    <p className="mt-2 text-base text-muted-foreground">{t.roles[value].subtitle}</p>

                    <form className="mt-7 flex flex-col gap-4" onSubmit={sendCode} noValidate>
                      <div className="flex flex-col gap-2">
                        <span id="phone-label" className="text-sm font-semibold">{t.phoneLabel}</span>
                        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="phone-label">
                          {(['in', 'other'] as const).map((c) => (
                            <button
                              key={c}
                              type="button"
                              role="radio"
                              aria-checked={country === c}
                              onClick={() => { setCountry(c); setNumber(''); setInvalidPhone(false); }}
                              className={cn(
                                'min-h-11 rounded-xl text-sm font-semibold ring-1 transition-colors',
                                country === c ? 'bg-[var(--crop-green-100)] text-[var(--crop-green-900)] ring-[var(--crop-green-500)]' : 'bg-white text-foreground/75 ring-border',
                              )}
                            >
                              {c === 'in' ? t.india : t.otherCountry}
                            </button>
                          ))}
                        </div>
                        <label className={cn(
                          'mt-1 flex h-16 items-center gap-3 rounded-2xl bg-white px-4 ring-1 transition-shadow focus-within:ring-2',
                          invalidPhone ? 'ring-destructive focus-within:ring-destructive' : 'ring-border focus-within:ring-[var(--crop-green-500)]',
                        )}>
                          {country === 'in' && <span className="text-xl font-semibold text-foreground/60">+91</span>}
                          <input
                            name="phone"
                            inputMode="tel"
                            autoComplete={country === 'in' ? 'tel-national' : 'tel'}
                            maxLength={country === 'in' ? 14 : 17}
                            value={number}
                            onChange={(e) => { setNumber(e.target.value.replace(country === 'in' ? /[^\d +]/g : /[^\d +\-()]/g, '')); setInvalidPhone(false); }}
                            placeholder={country === 'in' ? t.phonePlaceholder : t.otherPlaceholder}
                            aria-labelledby="phone-label"
                            aria-invalid={invalidPhone || undefined}
                            className="h-full w-full min-w-0 bg-transparent text-2xl font-semibold tracking-wider outline-none placeholder:text-base placeholder:font-normal placeholder:tracking-normal"
                          />
                        </label>
                        <p className="flex gap-2 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" /> {t.roles[value].help}</p>
                      </div>

                      <Button type="submit" disabled={otp.busy} className="h-14 rounded-2xl text-lg">
                        {otp.busy ? <Loader2 className="animate-spin" /> : null}
                        {t.sendOtp}
                        {!otp.busy ? <ArrowRight /> : null}
                      </Button>
                      {devMode && (
                        <p className="flex items-start gap-2 rounded-xl border border-dashed border-amber-400 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                          <FlaskConical className="mt-0.5 size-4 shrink-0" /> {t.devMode}
                        </p>
                      )}
                    </form>
                  </>
                ) : (
                  <>
                    <span className="w-fit rounded-full bg-[var(--crop-green-100)] px-3 py-1 text-xs font-semibold text-[var(--crop-green-900)]">
                      {t.continuingTo(t.roles[value].workspace)}
                    </span>
                    <h1 className="mt-4 text-[1.7rem] leading-tight font-semibold tracking-tight sm:text-3xl">{t.codeTitle}</h1>
                    <p className="mt-2 text-base text-muted-foreground">{t.codeHelp(prettyPhone(otp.phone ?? ''))}</p>
                    {otp.delivery === 'development' && otp.step === 'code' && (
                      <p className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-amber-400 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                        <FlaskConical className="mt-0.5 size-4 shrink-0" /> {t.devMode}
                      </p>
                    )}

                    {otp.step === 'done' ? (
                      <p role="status" className="mt-8 flex items-center gap-3 rounded-2xl bg-[var(--crop-green-100)] px-4 py-4 font-medium text-[var(--crop-green-900)]">
                        <Loader2 className="size-5 animate-spin" /> {t.success}
                      </p>
                    ) : (
                      <form className="mt-7 flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void verify(code); }}>
                        <InputOTP
                          maxLength={6}
                          pattern={REGEXP_ONLY_DIGITS}
                          value={code}
                          onChange={setCode}
                          onComplete={(v: string) => void verify(v)}
                          disabled={otp.busy}
                          aria-label={t.codeLabel}
                          autoFocus
                          containerClassName="w-full"
                        >
                          <InputOTPGroup className="w-full justify-between gap-2">
                            {Array.from({ length: 6 }, (_, i) => (
                              <InputOTPSlot
                                key={i}
                                index={i}
                                className="size-12 rounded-xl border bg-white text-2xl font-semibold first:rounded-xl first:border-l last:rounded-xl sm:size-14"
                              />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                        <Button type="submit" disabled={otp.busy || code.length !== 6} className="h-14 rounded-2xl text-lg">
                          {otp.busy ? <Loader2 className="animate-spin" /> : null} {t.verify}
                        </Button>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <button type="button" onClick={changeNumber} className="min-h-11 font-semibold text-[var(--crop-green-800)] hover:underline">
                            {t.changeNumber}
                          </button>
                          <button
                            type="button"
                            onClick={() => void otp.resend(role, lang)}
                            disabled={otp.cooldown > 0 || otp.busy}
                            className="min-h-11 font-semibold text-[var(--crop-green-800)] hover:underline disabled:text-muted-foreground disabled:no-underline"
                          >
                            {otp.cooldown > 0 ? t.resendIn(otp.cooldown) : t.resend}
                          </button>
                        </div>
                        <p aria-live="polite" className="sr-only">{otp.sentCount > 0 ? t.codeSent : ''}</p>
                      </form>
                    )}
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>

          {errorKey && (
            <Alert variant="destructive" className="mt-5" role="alert">
              <TriangleAlert />
              <AlertDescription>
                {t.errors[errorKey]}
                {!invalidPhone && otp.error?.attemptsLeft ? ` ${t.attemptsLeft(otp.error.attemptsLeft)}` : null}
                {otp.error?.debug && !invalidPhone ? <span className="mt-1 block font-mono text-xs opacity-70">[dev] {otp.error.debug}</span> : null}
              </AlertDescription>
            </Alert>
          )}

          {setupIssues.length > 0 && (
            <Alert className="mt-6 border-amber-300 bg-amber-50 text-amber-950">
              <TriangleAlert className="text-amber-600" />
              <AlertTitle>OTP setup needed (shown only in development)</AlertTitle>
              <AlertDescription className="text-amber-900">
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {setupIssues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
                <p className="mt-2">See docs/auth-migration/02-twilio-configuration.md and 03-development-otp.md.</p>
              </AlertDescription>
            </Alert>
          )}

        </div>

        <p className="mx-auto w-full max-w-md text-center text-xs text-muted-foreground">{t.privacyNote}</p>
      </main>
    </div>
  );
}
