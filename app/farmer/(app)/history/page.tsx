import Link from 'next/link';
import { Camera, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cropEmoji, cropName } from '@/lib/crops';
import { cn } from '@/lib/utils';
import { requireFarmer } from '@/server/auth/dal';
import { db } from '@/server/db';

export const metadata = { title: 'My reports' };

const REVIEW = { PENDING: { hi: 'विशेषज्ञ जांच बाकी', en: 'Expert review pending' }, CONFIRMED: { hi: 'विशेषज्ञ पुष्टि', en: 'Expert confirmed' }, CHALLENGED: { hi: 'विशेषज्ञ की अलग राय', en: 'Expert disagreed' }, NEEDS_INFO: { hi: 'और जानकारी चाहिए', en: 'More info needed' } } as const;

export default async function HistoryPage() {
  const farmer = await requireFarmer();
  const lang = farmer.language === 'en' ? 'en' : 'hi';
  const hi = lang === 'hi';
  const [rows, notifications] = await Promise.all([
    db.diagnosis.findMany({ where: { farmerId: farmer.userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    db.notification.findMany({ where: { userId: farmer.userId, readAt: null }, orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);
  if (notifications.length) {
    await db.notification.updateMany({ where: { id: { in: notifications.map((n) => n.id) } }, data: { readAt: new Date() } });
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pt-6 pb-6 lg:max-w-4xl lg:px-8 lg:pt-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight">{hi ? 'मेरी रिपोर्ट' : 'My reports'}</h1>
      {notifications.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li key={n.id} className="rounded-2xl bg-[var(--crop-green-100)] px-4 py-3 text-sm text-[var(--crop-green-900)]">
              <b>{n.title}</b> — {n.message}
            </li>
          ))}
        </ul>
      )}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[28px] bg-white px-6 py-12 text-center ring-1 ring-border">
          <span className="text-5xl" aria-hidden>🌱</span>
          <p className="text-lg font-semibold">{hi ? 'अभी कोई रिपोर्ट नहीं है' : 'No reports yet'}</p>
          <p className="text-sm text-muted-foreground">{hi ? 'अपनी फसल की पहली जांच करें।' : 'Check your first crop.'}</p>
          <Link href="/farmer/scan" className={cn(buttonVariants({ size: 'lg' }), 'h-14 rounded-2xl px-6 text-base')}><Camera /> {hi ? 'फसल जांचें' : 'Check my crop'}</Link>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/farmer/diagnosis/${r.id}`} className="flex items-center gap-4 rounded-[24px] bg-white p-3 pr-4 ring-1 ring-border active:scale-[0.99]">
                {/* eslint-disable-next-line @next/next/no-img-element -- private image route */}
                <img src={`/api/v1/images/diagnoses/${r.id}`} alt="" className="size-20 rounded-2xl object-cover" loading="lazy" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm text-muted-foreground">{cropEmoji(r.predictedCrop)} {cropName(r.predictedCrop, lang)}</span>
                  <span className="truncate text-lg font-semibold">{r.predictedCondition}</span>
                  <span className="text-xs text-muted-foreground">{r.createdAt.toLocaleDateString(hi ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' })} · {Math.round(r.confidence * 100)}%</span>
                  {r.reviewStatus !== 'UNREVIEWED' && <Badge variant="outline" className="mt-1 w-fit">{REVIEW[r.reviewStatus][lang]}</Badge>}
                </span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
