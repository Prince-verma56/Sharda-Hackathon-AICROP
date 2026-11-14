import { Accent, PageIntro, eyebrowClass } from '@/components/app/page-intro';
import { cn } from '@/lib/utils';
import { requireVolunteer } from '@/server/auth/dal';
import { db } from '@/server/db';
import { VideoUpload } from './video-upload';

export const metadata = { title: 'Videos' };

const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'In review', tone: 'bg-amber-50 text-amber-900 ring-amber-200' },
  APPROVED: { label: 'Published', tone: 'bg-[var(--crop-green-100)] text-[var(--crop-green-900)] ring-[var(--crop-green-200)]' },
  REJECTED: { label: 'Not approved', tone: 'bg-red-50 text-red-800 ring-red-200' },
};

export default async function VideosPage() {
  const volunteer = await requireVolunteer();
  const videos = await db.volunteerVideo.findMany({ where: { volunteerId: volunteer.userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  const approved = volunteer.verificationStatus === 'VERIFIED';

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageIntro
        eyebrow={`${videos.length} submitted · ${videos.filter((v) => v.status === 'APPROVED').length} published`}
        title={
          <>
            Teach with <Accent>video</Accent>
          </>
        }
        description="Short videos in local languages help farmers more than text. Every video is reviewed by an admin before farmers see it."
      />
      <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
        <section className="rounded-[24px] bg-white p-5 ring-1 ring-border sm:p-6 lg:col-span-5">
          <p className={cn(eyebrowClass(), 'mb-4 text-[var(--crop-green-600)]')}>Submit a video</p>
          {approved ? (
            <VideoUpload />
          ) : (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">You can submit videos once an admin approves your volunteer account.</p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">Do not show farmers’ faces, names or phone numbers without their permission. Never recommend chemical doses — point farmers to the KVK or agriculture officer.</p>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
          {videos.length === 0 ? (
            <div className="rounded-[24px] bg-white p-8 text-center text-sm text-muted-foreground ring-1 ring-border sm:col-span-2">No videos yet. Your submissions and their review status appear here.</div>
          ) : (
            videos.map((v) => (
              <article key={v.id} className="overflow-hidden rounded-[24px] bg-white ring-1 ring-border">
                <video src={`/api/v1/videos/${v.id}`} poster={v.thumbnailKey ? `/api/v1/videos/${v.id}/thumbnail` : undefined} controls preload="none" className="aspect-video w-full bg-black" />
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{v.title}</p>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1', STATUS[v.status].tone)}>{STATUS[v.status].label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {v.createdAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })} · {(v.bytes / 1024 / 1024).toFixed(1)} MB
                  </p>
                  {v.reviewNote && <p className="rounded-xl bg-muted px-3 py-2 text-xs">Admin note: {v.reviewNote}</p>}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
