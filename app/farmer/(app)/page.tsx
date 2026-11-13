import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Bell, Camera, FileText, Landmark, MapPin, Mic, Settings2, UserRound } from 'lucide-react';
import { Accent, PageIntro, eyebrowClass, labelClass } from '@/components/app/page-intro';
import { CropThumb } from '@/components/crops/crop-thumb';
import { cropName } from '@/lib/crops';
import { t } from '@/lib/i18n/farmer';
import { cn } from '@/lib/utils';
import { requireFarmer } from '@/server/auth/dal';
import { getCropImages } from '@/server/cropai/crop-images';
import { getSettings } from '@/server/cropai/settings';
import { fetchWeather } from '@/server/cropai/weather';
import { db } from '@/server/db';

export const metadata = { title: 'Home' };

const card = 'rounded-[28px] bg-white ring-1 ring-border';

/**
 * Farmer home in the public site's design language. Three aligned rows:
 * hero + latest check · four shortcuts · weather + the farmer's crops. Only real data.
 */
export default async function FarmerHome() {
  const farmer = await requireFarmer();
  const lang = farmer.language === 'hi' ? 'hi' : 'en';
  const tx = t(lang);
  const hi = lang === 'hi';
  const [latest, farm, unread, checks, settings, profile, cropImages] = await Promise.all([
    db.diagnosis.findFirst({ where: { farmerId: farmer.userId }, orderBy: { createdAt: 'desc' } }),
    db.farm.findFirst({ where: { ownerId: farmer.userId, isPrimary: true } }),
    db.notification.count({ where: { userId: farmer.userId, readAt: null } }),
    db.diagnosis.count({ where: { farmerId: farmer.userId } }),
    getSettings(),
    db.farmerProfile.findUnique({ where: { userId: farmer.userId }, select: { mainCrops: true } }),
    getCropImages(),
  ]);
  const weather = farm?.latitude != null && farm.longitude != null ? await fetchWeather(farm.latitude, farm.longitude).catch(() => null) : null;
  const name = farmer.preferredName ? (hi ? `${farmer.preferredName} जी` : farmer.preferredName) : null;
  const crops = profile?.mainCrops ?? [];
  const label = labelClass(lang);
  const pill = cn('group inline-flex h-12 items-center gap-2 rounded-2xl px-5 font-semibold transition-colors', hi ? 'text-[15px]' : 'text-[12px] tracking-[0.12em] uppercase');

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

      {/* Row 1 — primary action + latest check (same height) */}
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <section aria-label={tx.checkCrop} className="relative overflow-hidden rounded-[28px] bg-[var(--crop-green-950)] text-white lg:col-span-8">
          <Image src="/images/home/leaf.jpg" alt="" fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 64vw, 100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--crop-green-950)]/90 via-[var(--crop-green-900)]/60 to-black/10" />
          <div className="relative flex h-full min-h-[22rem] flex-col justify-between gap-8 p-5 sm:p-7 lg:min-h-[26rem] lg:p-8">
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
                <Stat dark value={checks} label={hi ? 'जांच हुईं' : 'Checks done'} />
                <Stat value={unread} label={hi ? 'नई सूचनाएँ' : 'New updates'} />
              </div>
              <Link href="/farmer/scan" className={cn(pill, 'bg-white text-[var(--crop-ink)] shadow-lg hover:bg-[var(--crop-green-100)]')}>
                <Camera className="size-4" /> {hi ? 'जांच शुरू करें' : 'Start a check'}
                <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>
        </section>

        <section aria-label={tx.latestReport} className="lg:col-span-4">
          {latest ? (
            <Link href={`/farmer/diagnosis/${latest.id}`} className={cn(card, 'group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-[0_24px_48px_-32px_rgba(28,46,22,0.6)]')}>
              <div className="relative min-h-48 flex-1 overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- private authenticated image route */}
                <img src={`/api/v1/images/diagnoses/${latest.id}`} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <span className={cn(label, 'absolute top-3 left-3 rounded-full px-3 py-1 backdrop-blur-md', latest.isHealthy ? 'bg-[var(--crop-green-100)]/95 text-[var(--crop-green-900)]' : 'bg-amber-50/95 text-amber-900')}>
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
            <div className={cn(card, 'flex h-full flex-col overflow-hidden')}>
              <div className="relative min-h-44 flex-1">
                <Image src="/images/home/crop-wheat.jpg" alt="" fill sizes="(min-width: 1024px) 30vw, 100vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent" />
              </div>
              <div className="flex flex-col gap-2 p-5 pt-0">
                <span className={cn(eyebrowClass(lang), 'text-[var(--crop-green-600)]')}>{tx.latestReport}</span>
                <p className="text-2xl font-semibold tracking-tight">{tx.noReports}</p>
                <p className="text-sm text-muted-foreground">{hi ? 'पहली जांच के बाद आपकी रिपोर्ट यहाँ दिखेगी।' : 'Your report appears here after your first check.'}</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Row 2 — shortcuts */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <Tile href="/farmer/assistant" icon={Mic} tag={hi ? 'आवाज़ + चैट' : 'Voice + chat'} title={tx.talkMitra} hint={hi ? 'हिंग्लिश, हिंदी या English' : 'Hinglish, Hindi or English'} lang={lang} />
        <Tile href="/farmer/history" icon={FileText} tag={hi ? `${checks} जांच` : `${checks} ${checks === 1 ? 'check' : 'checks'}`} title={tx.myReports} hint={tx.myReportsHint} lang={lang} />
        <Tile href="/resources" icon={Landmark} tag={hi ? 'योजनाएँ' : 'Schemes'} title={hi ? 'खेती सहायता' : 'Farming support'} hint={hi ? 'सरकारी योजनाएँ और हेल्पलाइन' : 'Schemes and helplines'} lang={lang} />
        <Tile href="/farmer/settings" icon={Settings2} tag={hi ? 'सेटिंग्स' : 'Settings'} title={hi ? 'मित्र सेटिंग्स' : 'Mitra settings'} hint={hi ? 'भाषा, आवाज़ और स्वभाव' : 'Language, voice and tone'} lang={lang} />
      </ul>

      {/* Row 3 — weather + the farmer's crops */}
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <section aria-label={tx.weatherNow} className={cn(card, 'flex flex-col gap-4 p-5 sm:p-6 lg:col-span-7')}>
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
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-border/70">
                <WeatherStat value={`${weather.temperatureC ?? '—'}°`} label={hi ? 'तापमान °C' : 'Temp °C'} lang={lang} />
                <WeatherStat value={`${weather.humidityPct ?? '—'}%`} label={hi ? 'नमी' : 'Humidity'} lang={lang} />
                <WeatherStat value={`${weather.rainLast24hMm ?? '—'}`} label={hi ? 'बारिश मिमी, 24 घं.' : 'Rain mm, 24 h'} lang={lang} />
              </dl>
              <p className="text-[11px] text-muted-foreground">
                Open-Meteo · {weather.observedAt.replace('T', ' ')} · {hi ? 'सिर्फ़ मौसम की जानकारी, बीमारी का अनुमान नहीं' : 'weather context only, not a disease forecast'}
              </p>
            </>
          ) : (
            <Link href="/farmer/profile" className="group flex flex-1 items-center gap-4 rounded-2xl bg-[var(--crop-cream)] p-4 ring-1 ring-border transition-colors hover:bg-[var(--crop-green-100)]">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
                <MapPin className="size-5" strokeWidth={1.7} />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{tx.addLocation}</span>
                <span className="text-sm text-muted-foreground">{hi ? 'प्रोफ़ाइल में एक बार जोड़ें' : 'Add it once in your profile'}</span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          )}
        </section>

        <section aria-label={hi ? 'आपकी फसलें' : 'Your crops'} className={cn(card, 'flex flex-col gap-4 p-5 sm:p-6 lg:col-span-5')}>
          <div className="flex items-center justify-between gap-3">
            <span className={cn(eyebrowClass(lang), 'text-[var(--crop-green-600)]')}>{hi ? 'आपकी फसलें' : 'Your crops'}</span>
            <Link href="/farmer/profile" className="text-xs font-medium text-[var(--crop-green-800)] hover:underline">
              {hi ? 'बदलें' : 'Edit'}
            </Link>
          </div>
          {crops.length ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {crops.slice(0, 6).map((id) => (
                <li key={id}>
                  <Link href={`/farmer/scan?crop=${id}`} className="group flex items-center gap-2.5 rounded-2xl bg-[var(--crop-cream)] p-1.5 pr-3 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[var(--crop-green-100)]">
                    <CropThumb id={id} images={cropImages} size="md" />
                    <span className="min-w-0 flex-1 truncate">{cropName(id, lang)}</span>
                    <Camera className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Link href={farmer.onboarded ? '/farmer/profile' : '/farmer/onboarding'} className="group flex flex-1 items-center gap-4 rounded-2xl bg-[var(--crop-green-100)] p-4 text-[var(--crop-green-900)] transition-colors hover:bg-[var(--crop-green-200)]">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/70">
                <UserRound className="size-5" strokeWidth={1.7} />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{hi ? 'अपनी मुख्य फसलें जोड़ें' : 'Add your main crops'}</span>
                <span className="text-sm opacity-80">{hi ? 'मित्र आपकी फसलों के हिसाब से सलाह देगा' : 'Mitra tailors advice to your crops'}</span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ value, label, dark = false }: { value: number; label: string; dark?: boolean }) {
  return (
    <div className={cn('flex size-[84px] flex-col justify-between rounded-2xl p-3 sm:size-[92px]', dark ? 'bg-[var(--crop-ink)]/80 backdrop-blur-md' : 'bg-white/95 text-[var(--crop-ink)]')}>
      <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">{value}</span>
      <span className="text-[9px] leading-tight font-semibold tracking-[0.14em] uppercase opacity-75">{label}</span>
    </div>
  );
}

function Tile({
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
      <Link href={href} className="group flex h-full min-h-40 flex-col justify-between gap-6 rounded-[24px] bg-white p-5 ring-1 ring-border transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-28px_rgba(28,46,22,0.6)]">
        <span className="flex items-center justify-between gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)] transition-transform duration-500 group-hover:-rotate-6">
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
    <div className="flex flex-col-reverse justify-end gap-1 bg-[var(--crop-cream)] px-3 py-4">
      <dt className={cn(lang === 'hi' ? 'text-[12px]' : 'text-[9px] tracking-[0.14em] uppercase', 'font-semibold text-muted-foreground')}>{label}</dt>
      <dd className="text-3xl leading-none font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}
