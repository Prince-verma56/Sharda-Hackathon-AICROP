import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Bell, Camera } from 'lucide-react';
import { Accent, PageIntro, labelClass } from '@/components/app/page-intro';
import { CropThumb } from '@/components/crops/crop-thumb';
import { cropName } from '@/lib/crops';
import { cn } from '@/lib/utils';
import { requireFarmer } from '@/server/auth/dal';
import { getCropImages } from '@/server/cropai/crop-images';
import { db } from '@/server/db';

export const metadata = { title: 'My reports' };

const REVIEW = {
  PENDING: { hi: 'विशेषज्ञ जांच बाकी', en: 'Expert review pending' },
  CONFIRMED: { hi: 'विशेषज्ञ पुष्टि', en: 'Expert confirmed' },
  CHALLENGED: { hi: 'विशेषज्ञ की अलग राय', en: 'Expert disagreed' },
  NEEDS_INFO: { hi: 'और जानकारी चाहिए', en: 'More info needed' },
} as const;

export default async function HistoryPage() {
  const farmer = await requireFarmer();
  const lang = farmer.language === 'en' ? 'en' : 'hi';
  const hi = lang === 'hi';
  const [rows, notifications, cropImages] = await Promise.all([
    db.diagnosis.findMany({ where: { farmerId: farmer.userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    db.notification.findMany({ where: { userId: farmer.userId, readAt: null }, orderBy: { createdAt: 'desc' }, take: 5 }),
    getCropImages(),
  ]);
  if (notifications.length) {
    await db.notification.updateMany({ where: { id: { in: notifications.map((n) => n.id) } }, data: { readAt: new Date() } });
  }
  const label = labelClass(lang);
  const checkButton = (
    <Link
      href="/farmer/scan"
      className={cn(
        'group inline-flex h-12 items-center gap-2 rounded-2xl bg-[var(--crop-green-800)] px-5 font-semibold text-white transition-colors hover:bg-[var(--crop-green-900)]',
        hi ? 'text-[15px]' : 'text-[12px] tracking-[0.12em] uppercase',
      )}
    >
      <Camera className="size-4" /> {hi ? 'नई जांच' : 'New check'}
      <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );

  return (
    <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-6 px-4 pt-6 pb-8 sm:px-6 lg:gap-8 lg:px-8 lg:pt-10">
      <PageIntro
        lang={lang}
        eyebrow={hi ? `${rows.length} जांच` : `${rows.length} ${rows.length === 1 ? 'check' : 'checks'}`}
        title={
          hi ? (
            <>
              मेरी <Accent>रिपोर्ट</Accent>
            </>
          ) : (
            <>
              My <Accent>reports</Accent>
            </>
          )
        }
        description={hi ? 'हर जांच की फोटो, AI नतीजा और विशेषज्ञ की राय।' : 'Every check with its photo, AI result and expert review.'}
        actions={rows.length > 0 ? checkButton : undefined}
      />

      {notifications.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-2xl bg-[var(--crop-green-100)] px-4 py-3 text-sm text-[var(--crop-green-900)]">
              <Bell className="mt-0.5 size-4 shrink-0" />
              <span>
                <b>{n.title}</b> — {n.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 ? (
        <section className="relative overflow-hidden rounded-[28px] bg-[var(--crop-green-950)] text-white">
          <Image src="/images/home/leaf.jpg" alt="" fill sizes="(min-width: 1024px) 80vw, 100vw" className="object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--crop-green-950)] via-[var(--crop-green-950)]/80 to-transparent" />
          <div className="relative flex min-h-[18rem] flex-col justify-center gap-4 p-6 sm:p-10">
            <p className={cn(label, 'text-[var(--crop-green-200)]')}>{hi ? 'अभी कोई रिपोर्ट नहीं' : 'No reports yet'}</p>
            <h2 className={cn('max-w-lg text-[clamp(1.8rem,4vw,3rem)] font-semibold', hi ? 'leading-[1.15] tracking-tight' : 'leading-[0.95] tracking-[-0.04em] uppercase')}>
              {hi ? 'अपनी पहली फसल जांच करें' : 'Check your first crop'}
            </h2>
            <p className="max-w-md text-white/80">{hi ? 'एक पत्ती की फोटो लें — रिपोर्ट यहाँ सेव होगी।' : 'Take one leaf photo — the report is saved here.'}</p>
            <Link
              href="/farmer/scan"
              className={cn(
                'group inline-flex h-12 w-fit items-center gap-2 rounded-2xl bg-white px-5 font-semibold text-[var(--crop-ink)] transition-colors hover:bg-[var(--crop-green-100)]',
                hi ? 'text-[15px]' : 'text-[12px] tracking-[0.12em] uppercase',
              )}
            >
              {hi ? 'जांच शुरू करें' : 'Start a check'} <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </section>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/farmer/diagnosis/${r.id}`} className="group flex h-full flex-col overflow-hidden rounded-[24px] bg-white ring-1 ring-border transition-shadow hover:shadow-[0_24px_48px_-32px_rgba(28,46,22,0.6)]">
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private authenticated image route */}
                  <img src={`/api/v1/images/diagnoses/${r.id}`} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <span
                    className={cn(
                      label,
                      'absolute top-3 left-3 rounded-full px-3 py-1 backdrop-blur-md',
                      r.isHealthy ? 'bg-[var(--crop-green-100)]/95 text-[var(--crop-green-900)]' : 'bg-amber-50/95 text-amber-900',
                    )}
                  >
                    {r.isHealthy ? (hi ? 'स्वस्थ जैसा' : 'Looks healthy') : hi ? 'ध्यान दें' : 'Needs attention'}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CropThumb id={r.predictedCrop} images={cropImages} size="xs" className="rounded-full" />
                    {cropName(r.predictedCrop, lang)}
                    <span aria-hidden>·</span>
                    {r.createdAt.toLocaleDateString(hi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <p className="text-xl leading-tight font-semibold tracking-tight">{r.predictedCondition}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn(label, 'rounded-full bg-[var(--crop-cream)] px-2.5 py-1 text-foreground/70 ring-1 ring-border')}>
                        {hi ? 'मॉडल स्कोर' : 'Model score'} {Math.round(r.confidence * 100)}%
                      </span>
                      {r.reviewStatus !== 'UNREVIEWED' && (
                        <span className={cn(label, 'rounded-full bg-[var(--crop-green-100)] px-2.5 py-1 text-[var(--crop-green-900)]')}>{REVIEW[r.reviewStatus][lang]}</span>
                      )}
                    </span>
                    <ArrowUpRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
