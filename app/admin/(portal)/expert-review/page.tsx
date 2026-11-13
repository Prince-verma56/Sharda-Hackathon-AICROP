import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cropName } from '@/lib/crops';
import { requireStaff } from '@/server/auth/dal';
import { db } from '@/server/db';
import { EmptyState, fmtDate, PageHeader, pct, ReviewBadge } from '../ui';

export const metadata = { title: 'Expert review' };

export default async function ExpertReviewQueue() {
  await requireStaff('reviews:write');
  const queue = await db.diagnosis.findMany({
    where: { reviewStatus: { in: ['PENDING', 'NEEDS_INFO'] } },
    orderBy: [{ reviewRequestedAt: 'asc' }, { createdAt: 'asc' }],
    take: 60,
    select: { id: true, createdAt: true, reviewRequestedAt: true, predictedCrop: true, predictedCondition: true, confidence: true, reviewStatus: true, advisories: true },
  });
  return (
    <>
      <PageHeader title="Expert review" description="Oldest requests first. Includes farmer requests and uncertain results queued automatically." />
      {queue.length === 0 ? (
        <EmptyState title="Queue is clear" text="New requests appear here when farmers ask for an expert or the model flags uncertainty." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {queue.map((d) => (
            <Link key={d.id} href={`/admin/diagnoses/${d.id}`}>
              <Card className="flex-row gap-3 rounded-2xl p-3 transition hover:ring-[var(--crop-green-500)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- authorised private image */}
                <img src={`/api/v1/images/diagnoses/${d.id}`} alt="" className="size-24 rounded-xl object-cover" loading="lazy" />
                <span className="flex min-w-0 flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">{cropName(d.predictedCrop)}</span>
                  <span className="truncate font-semibold">{d.predictedCondition}</span>
                  <span className="text-xs text-muted-foreground">Model score {pct(d.confidence)} · {(d.advisories as unknown[]).length} flag(s)</span>
                  <span className="text-xs text-muted-foreground">Requested {fmtDate(d.reviewRequestedAt ?? d.createdAt)}</span>
                  <ReviewBadge status={d.reviewStatus} />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
