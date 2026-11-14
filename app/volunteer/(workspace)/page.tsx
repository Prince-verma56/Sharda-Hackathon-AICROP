import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, ArrowUpRight, BookOpenCheck, Clapperboard, Clock, Cpu, Flag, Landmark, ShieldCheck, Smartphone, UserRoundCheck } from 'lucide-react';
import { Accent, PageIntro, eyebrowClass } from '@/components/app/page-intro';
import { cn } from '@/lib/utils';
import { requireVolunteer } from '@/server/auth/dal';
import { db } from '@/server/db';

export const metadata = { title: 'Home' };

const TRAINING: Record<string, string> = { NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', COMPLETED: 'Completed' };

const RESOURCES = [
  { href: '/how-it-works', icon: BookOpenCheck, tag: 'Guide', title: 'How CropAI works', hint: 'Walk farmers through a check' },
  { href: '/insights', icon: Cpu, tag: 'Limits', title: 'What the AI can and cannot do', hint: 'Screening, not a lab test' },
  { href: '/resources', icon: Landmark, tag: 'Schemes', title: 'Government resources', hint: 'Schemes, helplines, KVKs' },
  { href: '/data-rights', icon: ShieldCheck, tag: 'Privacy', title: 'Farmers’ data rights', hint: 'Consent, access, deletion' },
];

const RULES = [
  { icon: Smartphone, text: 'Farmers sign in with their own mobile number. Never use a farmer’s phone or OTP on their behalf.' },
  { icon: UserRoundCheck, text: 'Ask before taking a photo of someone’s crop, and let the farmer tick the consent box themselves.' },
  { icon: ShieldCheck, text: 'AI results are a screening, not a confirmed diagnosis. Point farmers to their agriculture officer or KVK before any chemical use.' },
];

/** Volunteer overview — real counts from the volunteer programme tables only. */
export default async function VolunteerHome() {
  const volunteer = await requireVolunteer();
  if (!volunteer.profileComplete) redirect('/volunteer/profile');
  const approved = volunteer.verificationStatus === 'VERIFIED';
  const [activity, published, campaigns] = await Promise.all([
    db.volunteerActivity.aggregate({ where: { volunteerId: volunteer.userId }, _count: true, _sum: { farmersReached: true } }),
    db.volunteerVideo.count({ where: { volunteerId: volunteer.userId, status: 'APPROVED' } }),
    db.campaign.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 4 }),
  ]);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageIntro
        eyebrow="Volunteer workspace"
        title={
          <>
            Namaste{volunteer.name ? ', ' : ''}
            {volunteer.name ? <Accent>{volunteer.name}</Accent> : null}
          </>
        }
        description="Thank you for helping farmers use CropAI safely in your area."
        actions={
          approved ? (
            <Link href="/volunteer/activities" className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-[var(--crop-green-800)] px-5 text-[12px] font-semibold tracking-[0.12em] text-white uppercase transition-colors hover:bg-[var(--crop-green-900)]">
              Log activity <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          ) : undefined
        }
      />

      {!approved && (
        <p className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <Clock className="mt-0.5 size-4 shrink-0" />
          {volunteer.verificationStatus === 'SUSPENDED'
            ? 'Your volunteer access is suspended. Contact your programme administrator.'
            : 'Your profile is complete. An admin will approve your volunteer account — then you can log activities and submit videos.'}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <section className="relative overflow-hidden rounded-[28px] bg-[var(--crop-green-950)] text-white lg:col-span-7">
          <Image src="/images/home/hero.jpg" alt="" fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 56vw, 100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--crop-green-950)]/90 via-[var(--crop-green-900)]/65 to-black/10" />
          <div className="relative flex h-full min-h-[22rem] flex-col justify-between gap-8 p-5 sm:p-7 lg:min-h-[26rem] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <span className="text-base font-semibold tracking-tight sm:text-lg">
                CROPAI<sup className="ml-0.5 text-[0.55em]">®</sup>
              </span>
              <span className={cn('rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase backdrop-blur-md', approved ? 'bg-[var(--crop-green-100)]/95 text-[var(--crop-green-900)]' : 'border border-white/30')}>
                {approved ? 'Approved' : volunteer.verificationStatus === 'SUSPENDED' ? 'Suspended' : 'Awaiting approval'}
              </span>
            </div>
            <h2 className="max-w-xl text-[clamp(2rem,4.6vw,3.6rem)] leading-[0.92] font-semibold tracking-[-0.045em] uppercase">
              Help farmers <span className="text-[var(--crop-green-200)]">check their crops</span>
            </h2>
            <div className="flex flex-wrap gap-2.5">
              <Chip dark value={String(activity._count)} label="Activities" />
              <Chip value={String(activity._sum.farmersReached ?? 0)} label="Farmers reached" />
              <Chip dark value={String(published)} label="Videos published" />
              <Chip value={TRAINING[volunteer.trainingStatus] ?? volunteer.trainingStatus} label="Training" />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-[28px] bg-white p-5 ring-1 ring-border sm:p-7 lg:col-span-5">
          <p className={cn(eyebrowClass(), 'text-[var(--crop-green-600)]')}>Active campaigns</p>
          {campaigns.length === 0 ? (
            <p className="rounded-2xl bg-[var(--crop-cream)] p-4 text-sm text-muted-foreground ring-1 ring-border">No campaign right now. You can still log field visits and help farmers.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {campaigns.map((c) => (
                <li key={c.id} className="flex gap-3 rounded-2xl bg-[var(--crop-cream)] p-3.5 ring-1 ring-border">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
                    <Flag className="size-5" strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{c.title}</span>
                    <span className="line-clamp-2 text-sm text-muted-foreground">{c.description}</span>
                    {(c.region || c.endsOn) && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {[c.region, c.endsOn ? `until ${c.endsOn.toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : null].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto grid grid-cols-2 gap-2">
            <Link href="/volunteer/activities" className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--crop-green-100)] px-3 py-3 text-sm font-semibold text-[var(--crop-green-900)] hover:bg-[var(--crop-green-200)]">
              <Activity className="size-4" /> Activities
            </Link>
            <Link href="/volunteer/videos" className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--crop-green-100)] px-3 py-3 text-sm font-semibold text-[var(--crop-green-900)] hover:bg-[var(--crop-green-200)]">
              <Clapperboard className="size-4" /> Videos
            </Link>
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-4 rounded-[28px] bg-white p-5 ring-1 ring-border sm:p-7">
        <p className={cn(eyebrowClass(), 'text-[var(--crop-green-600)]')}>Before every visit</p>
        <ul className="grid gap-4 md:grid-cols-3">
          {RULES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
                <Icon className="size-5" strokeWidth={1.7} />
              </span>
              <span className="text-[15px] leading-relaxed">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <ul className="grid gap-px overflow-hidden rounded-2xl bg-border/70 sm:grid-cols-2 lg:grid-cols-4">
        {RESOURCES.map(({ href, icon: Icon, tag, title, hint }) => (
          <li key={href}>
            <Link href={href} className="group flex h-full min-h-40 flex-col justify-between gap-6 bg-[var(--crop-cream)] p-5 transition-colors hover:bg-[var(--crop-green-100)] lg:p-6">
              <span className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)] transition-transform duration-500 group-hover:-rotate-6 group-hover:bg-white">
                  <Icon className="size-5" strokeWidth={1.7} />
                </span>
                <span className="text-[10px] font-semibold tracking-[0.16em] text-[var(--crop-green-600)] uppercase">{tag}</span>
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
        ))}
      </ul>
    </div>
  );
}

function Chip({ value, label, dark = false }: { value: string; label: string; dark?: boolean }) {
  return (
    <div className={cn('flex min-h-[84px] max-w-[14rem] min-w-[84px] flex-col justify-between gap-2 rounded-2xl p-3', dark ? 'bg-[var(--crop-ink)]/80 backdrop-blur-md' : 'bg-white/95 text-[var(--crop-ink)]')}>
      <span className="line-clamp-2 text-xl leading-tight font-semibold tracking-tight tabular-nums">{value}</span>
      <span className="text-[9px] leading-tight font-semibold tracking-[0.14em] uppercase opacity-75">{label}</span>
    </div>
  );
}
