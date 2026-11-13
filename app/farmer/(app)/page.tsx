import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Bell, ChevronRight, FileText, Landmark, MapPin, Mic, UserRound } from 'lucide-react';
import { Accent, PageIntro, eyebrowClass, labelClass } from '@/components/app/page-intro';
import { cropName } from '@/lib/crops';
import { t } from '@/lib/i18n/farmer';
import { cn } from '@/lib/utils';
import { requireFarmer } from '@/server/auth/dal';
import { getSettings } from '@/server/cropai/settings';
import { fetchWeather } from '@/server/cropai/weather';
import { db } from '@/server/db';

export const metadata = { title: 'Home' };

/**
 * Farmer home in the public site's design language: display heading, photo hero with stat chips
 * (real counts only), feature row, then the latest check and local weather.
 */
export default async function FarmerHome() {
  const farmer = await requireFarmer();
  const lang = farmer.language === 'hi' ? 'hi' : 'en';
  const tx = t(lang);
  const hi = lang === 'hi';
  const [latest, farm, unread, checks, settings] = await Promise.all([
    db.diagnosis.findFirst({ where: { farmerId: farmer.userId }, orderBy: { createdAt: 'desc' } }),
    db.farm.findFirst({ where: { ownerId: farmer.userId, isPrimary: true } }),
    db.notification.count({ where: { userId: farmer.userId, readAt: null } }),
    db.diagnosis.count({ where: { farmerId: farmer.userId } }),
    getSettings(),
  ]);
  const weather = farm?.latitude != null && farm.longitude != null ? await fetchWeather(farm.latitude, farm.longitude).catch(() => null) : null;
  const name = farmer.preferredName ? (hi ? `${farmer.preferredName} जी` : farmer.preferredName) : null;
  const label = labelClass(lang);

  return (
    <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-6 px-4 pt-6 pb-8 sm:px-6 lg:gap-8 lg:px-8 lg:pt-10">
      <PageIntro
        lang={lang}
        eyebrow={hi ? 'किसान डैशबोर्ड' : 'Farmer dashboard'}
        title={
          <>
            {tx.namaste}
            {name ? (
              <>
                , <Accent>{name}</Accent>
              </>
            ) : null}
          </>
        }
        description={tx.homeQuestion}
        actions={
          <Link
            href="/farmer/history"
            aria-label={hi ? `सूचनाएँ (${unread} नई)` : `Notifications (${unread} new)`}
            className="relative grid size-12 place-items-center rounded-2xl bg-white ring-1 ring-border transition-colors hover:bg-[var(--crop-green-100)]"
          >
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-[var(--crop-green-600)] px-1 text-[11px] font-bold text-white">{unread}</span>}
          </Link>
        }
      />

      {settings.farmer_notice && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{settings.farmer_notice}</p>}

      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col gap-5 lg:col-span-7 lg:gap-6">
          {/* Primary action — the home hero's photo card */}
          <section aria-label={tx.checkCrop} className="relative overflow-hidden rounded-[28px] bg-[var(--crop-green-950)] text-white">
            <Image src="/images/home/leaf.jpg" alt="" fill fetchPriority="high" sizes="(min-width: 1024px) 56vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--crop-green-950)]/90 via-[var(--crop-green-900)]/60 to-black/10" />
            <div className="relative flex min-h-[22rem] flex-col justify-between gap-8 p-5 sm:p-7 lg:min-h-[27rem] lg:p-8">
              <div className="flex items-start justify-between gap-3">
                <span className="text-base font-semibold tracking-tight sm:text-lg">
                  CROPAI<sup className="ml-0.5 text-[0.55em]">®</sup>
                </span>
                <span className={cn(label, 'rounded-full border border-white/30 px-3 py-1 backdrop-blur-md')}>{hi ? 'AI फसल जांच' : 'AI crop check'}</span>
              </div>
              <div>
                <h2 className={cn('text-[clamp(2.1rem,5vw,3.8rem)]', hi ? 'leading-[1.15] font-semibold tracking-tight' : 'leading-[0.92] font-semibold tracking-[-0.045em] uppercase')}>
                  {hi ? (
                    <>
                      अपनी <span className="text-[var(--crop-green-200)]">फसल</span> जांचें
                    </>
                  ) : (
                    <>
                      Check your <span className="text-[var(--crop-green-200)]">crop</span>
                    </>
                  )}
                </h2>
                <p className="mt-3 max-w-md text-base text-white/80 lg:text-lg">
                  {hi ? 'एक पत्ती की फोटो लें — AI बताएगा क्या दिख रहा है और आगे क्या करें।' : 'Take one leaf photo — the AI shows what it sees and what to do next.'}
                </p>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex gap-2.5">
                  <div className="flex size-[84px] flex-col justify-between rounded-2xl bg-[var(--crop-ink)]/80 p-3 backdrop-blur-md sm:size-[92px]">
                    <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">{checks}</span>
                    <span className="text-[9px] leading-tight font-semibold tracking-[0.14em] uppercase opacity-80">{hi ? 'जांच हुईं' : 'Checks done'}</span>
                  </div>
                  <div className="flex size-[84px] flex-col justify-between rounded-2xl bg-white/95 p-3 text-[var(--crop-ink)] sm:size-[92px]">
                    <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">{unread}</span>
                    <span className="text-[9px] leading-tight font-semibold tracking-[0.14em] uppercase opacity-70">{hi ? 'नई सूचनाएँ' : 'New updates'}</span>
                  </div>
                </div>
                <Link
                  href="/farmer/scan"
                  className={cn(
                    'group inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 font-semibold text-[var(--crop-ink)] shadow-lg transition-colors hover:bg-[var(--crop-green-100)]',
                    hi ? 'text-[15px]' : 'text-[12px] tracking-[0.12em] uppercase',
                  )}
                >
                  {hi ? 'जांच शुरू करें' : 'Start a check'}
                  <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </div>
          </section>

          {/* Feature row */}
          <ul className="grid gap-px overflow-hidden rounded-2xl bg-border/70 sm:grid-cols-3">
            <FeatureTile href="/farmer/assistant" icon={Mic} tag={hi ? 'आवाज़' : 'Voice'} title={tx.talkMitra} hint={hi ? 'हिंदी या English में बोलें या लिखें' : 'Speak or type, Hindi or English'} lang={lang} />
            <FeatureTile href="/farmer/history" icon={FileText} tag={String(checks)} title={tx.myReports} hint={tx.myReportsHint} lang={lang} />
            <FeatureTile href="/resources" icon={Landmark} tag={hi ? 'योजनाएँ' : 'Schemes'} title={hi ? 'खेती सहायता' : 'Farming support'} hint={hi ? 'सरकारी योजनाएँ और हेल्पलाइन' : 'Government schemes & helplines'} lang={lang} />
          </ul>
        </div>

        {/* Context */}
        <div className="flex flex-col gap-5 lg:col-span-5 lg:gap-6">
          <section aria-label={tx.latestReport}>
            {latest ? (
              <Link href={`/farmer/diagnosis/${latest.id}`} className="group block overflow-hidden rounded-[28px] bg-white ring-1 ring-border transition-shadow hover:shadow-[0_24px_48px_-32px_rgba(28,46,22,0.6)]">
                <div className="relative aspect-[16/9] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private authenticated image route */}
                  <img src={`/api/v1/images/diagnoses/${latest.id}`} alt="" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <span
                    className={cn(
                      label,
                      'absolute top-3 left-3 rounded-full px-3 py-1 backdrop-blur-md',
                      latest.isHealthy ? 'bg-[var(--crop-green-100)]/95 text-[var(--crop-green-900)]' : 'bg-amber-50/95 text-amber-900',
                    )}
                  >
                    {latest.isHealthy ? (hi ? 'स्वस्थ जैसा' : 'Looks healthy') : hi ? 'ध्यान दें' : 'Needs attention'}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3 p-5">
                  <span className="min-w-0">
                    <span className={cn(eyebrowClass(lang), 'block text-[var(--crop-green-600)]')}>
                      {tx.latestReport} · {latest.createdAt.toLocaleDateString(hi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{cropName(latest.predictedCrop, lang)}</span>
                    <span className="block truncate text-2xl font-semibold tracking-tight">{latest.predictedCondition}</span>
                  </span>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-800)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRight className="size-5" />
                  </span>
                </div>
              </Link>
            ) : (
              <div className="flex flex-col gap-3 rounded-[28px] bg-white p-6 ring-1 ring-border">
                <span className={cn(eyebrowClass(lang), 'text-[var(--crop-green-600)]')}>{tx.latestReport}</span>
                <p className="text-xl font-semibold tracking-tight">{tx.noReports}</p>
                <p className="text-sm text-muted-foreground">{hi ? 'पहली जांच के बाद आपकी रिपोर्ट यहाँ दिखेगी।' : 'Your report will appear here after your first check.'}</p>
              </div>
            )}
          </section>

          <section aria-label={tx.weatherNow} className="rounded-[28px] bg-white p-5 ring-1 ring-border">
            <div className="flex items-center justify-between gap-3">
              <span className={cn(eyebrowClass(lang), 'text-[var(--crop-green-600)]')}>{tx.weatherNow}</span>
              {farm?.locationLabel && (
                <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{farm.locationLabel}</span>
                </span>
              )}
            </div>
            {weather ? (
              <>
                <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-border/70">
                  <WeatherStat value={`${weather.temperatureC ?? '—'}°`} label={hi ? 'तापमान' : 'Temp °C'} lang={lang} />
                  <WeatherStat value={`${weather.humidityPct ?? '—'}%`} label={hi ? 'नमी' : 'Humidity'} lang={lang} />
                  <WeatherStat value={`${weather.rainLast24hMm ?? '—'}`} label={hi ? 'बारिश मिमी, 24 घं.' : 'Rain mm, 24 h'} lang={lang} />
                </dl>
                <p className="mt-3 text-[11px] text-muted-foreground">Open-Meteo · {weather.observedAt.replace('T', ' ')}</p>
              </>
            ) : (
              <Link href="/farmer/profile" className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--crop-cream)] px-4 py-3.5 text-sm text-muted-foreground ring-1 ring-border transition-colors hover:bg-[var(--crop-green-100)]">
                <MapPin className="size-5 shrink-0 text-[var(--crop-green-600)]" />
                {tx.addLocation}
                <ChevronRight className="ml-auto size-4 shrink-0" />
              </Link>
            )}
          </section>

          {!farmer.onboarded && (
            <Link href="/farmer/onboarding" className="flex items-center gap-3 rounded-2xl bg-[var(--crop-green-100)] px-4 py-3.5 text-sm font-medium text-[var(--crop-green-900)] transition-colors hover:bg-[var(--crop-green-200)]">
              <UserRound className="size-5 shrink-0" />
              {hi ? 'अपनी प्रोफ़ाइल पूरी करें (वैकल्पिक)' : 'Complete your profile (optional)'}
              <ChevronRight className="ml-auto size-4 shrink-0" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureTile({
  href,
  icon: Icon,
  tag,
  title,
  hint,
  lang,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tag: string;
  title: string;
  hint: string;
  lang: string;
}) {
  return (
    <li>
      <Link href={href} className="group flex h-full min-h-40 flex-col justify-between gap-6 bg-[var(--crop-cream)] p-5 transition-colors hover:bg-[var(--crop-green-100)] lg:p-6">
        <span className="flex items-center justify-between">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)] transition-transform duration-500 group-hover:-rotate-6 group-hover:bg-white">
            <Icon className="size-5" strokeWidth={1.7} />
          </span>
          <span className={cn(labelClass(lang), 'text-[var(--crop-green-600)]')}>{tag}</span>
        </span>
        <span>
          <span className="flex items-center justify-between gap-2 text-lg leading-tight font-semibold tracking-tight">
            {title}
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">{hint}</span>
        </span>
      </Link>
    </li>
  );
}

function WeatherStat({ value, label, lang }: { value: string; label: string; lang: string }) {
  return (
    <div className="flex flex-col-reverse justify-end gap-1 bg-[var(--crop-cream)] px-3 py-3.5">
      <dt className={cn(lang === 'hi' ? 'text-[12px]' : 'text-[9px] tracking-[0.14em] uppercase', 'font-semibold text-muted-foreground')}>{label}</dt>
      <dd className="text-2xl leading-none font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}
