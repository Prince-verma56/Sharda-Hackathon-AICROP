import { Activity, HandHeart, MapPin } from 'lucide-react';
import { Accent, PageIntro, eyebrowClass } from '@/components/app/page-intro';
import { cn } from '@/lib/utils';
import { requireVolunteer } from '@/server/auth/dal';
import { db } from '@/server/db';
import { ActivityForm } from './activity-form';

export const metadata = { title: 'Activities' };

const KIND: Record<string, string> = { FIELD_VISIT: 'Field visit', AWARENESS_SESSION: 'Awareness session', FARMER_ASSISTANCE: 'Farmer help', TRAINING: 'Training' };

export default async function ActivitiesPage() {
  const volunteer = await requireVolunteer();
  const [activities, campaigns] = await Promise.all([
    db.volunteerActivity.findMany({ where: { volunteerId: volunteer.userId }, orderBy: { occurredOn: 'desc' }, take: 100, include: { campaign: { select: { title: true } } } }),
    db.campaign.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true } }),
  ]);
  const reached = activities.reduce((n, a) => n + a.farmersReached, 0);
  const approved = volunteer.verificationStatus === 'VERIFIED';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageIntro
        eyebrow={`${activities.length} activities · ${reached} farmers reached`}
        title={
          <>
            Your <Accent>field work</Accent>
          </>
        }
        description="Log visits, awareness sessions and the help you gave. Only counts and notes are recorded — never farmers' private details."
      />
      <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
        <section className="rounded-[24px] bg-white p-5 ring-1 ring-border sm:p-6 lg:col-span-5">
          <p className={cn(eyebrowClass(), 'mb-4 text-[var(--crop-green-600)]')}>Log an activity</p>
          {approved ? (
            <ActivityForm campaigns={campaigns} today={today} />
          ) : (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">You can log activities once an admin approves your volunteer account.</p>
          )}
        </section>
        <section className="flex flex-col gap-3 lg:col-span-7">
          {activities.length === 0 ? (
            <div className="rounded-[24px] bg-white p-8 text-center text-sm text-muted-foreground ring-1 ring-border">No activities yet. Your first field visit will appear here.</div>
          ) : (
            activities.map((a) => (
              <article key={a.id} className="flex gap-4 rounded-[24px] bg-white p-4 ring-1 ring-border sm:p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
                  <Activity className="size-5" strokeWidth={1.7} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{KIND[a.kind]}</p>
                    <span className="text-xs text-muted-foreground">{a.occurredOn.toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {a.village && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5" /> {a.village}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <HandHeart className="size-3.5" /> {a.farmersReached} farmers
                    </span>
                    {a.campaign && <span>· {a.campaign.title}</span>}
                  </p>
                  {a.notes && <p className="mt-2 text-sm">{a.notes}</p>}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
