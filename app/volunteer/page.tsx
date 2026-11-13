import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, BookOpenCheck, Cpu, Landmark, ShieldCheck, Smartphone, UserRoundCheck } from 'lucide-react';
import { Accent, PageIntro, eyebrowClass } from '@/components/app/page-intro';
import { cn } from '@/lib/utils';
import { requireVolunteer } from '@/server/auth/dal';

export const metadata = { title: 'Home' };

const VERIFICATION: Record<string, string> = { PENDING: 'Awaiting admin', VERIFIED: 'Verified', SUSPENDED: 'Suspended' };
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

/** Volunteer home. Only real profile fields are shown; campaigns and visit logs arrive with the programme module. */
export default async function VolunteerHome() {
  const volunteer = await requireVolunteer();
  if (!volunteer.profileComplete) redirect('/volunteer/profile');
  const verified = volunteer.verificationStatus === 'VERIFIED';

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
          <Link
            href="/volunteer/profile"
            className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-[12px] font-semibold tracking-[0.12em] uppercase ring-1 ring-border transition-colors hover:bg-[var(--crop-green-100)]"
          >
            Edit profile <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <section className="relative overflow-hidden rounded-[28px] bg-[var(--crop-green-950)] text-white lg:col-span-7">
          <Image src="/images/home/hero.jpg" alt="" fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 56vw, 100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--crop-green-950)]/90 via-[var(--crop-green-900)]/65 to-black/10" />
          <div className="relative flex min-h-[22rem] flex-col justify-between gap-8 p-5 sm:p-7 lg:min-h-[26rem] lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <span className="text-base font-semibold tracking-tight sm:text-lg">
                CROPAI<sup className="ml-0.5 text-[0.55em]">®</sup>
              </span>
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase backdrop-blur-md',
                  verified ? 'bg-[var(--crop-green-100)]/95 text-[var(--crop-green-900)]' : 'border border-white/30',
                )}
              >
                {VERIFICATION[volunteer.verificationStatus] ?? volunteer.verificationStatus}
              </span>
            </div>
            <h2 className="max-w-xl text-[clamp(2rem,4.6vw,3.6rem)] leading-[0.92] font-semibold tracking-[-0.045em] uppercase">
              Help farmers <span className="text-[var(--crop-green-200)]">check their crops</span>
            </h2>
            <div className="flex flex-wrap gap-2.5">
              <Chip dark value={volunteer.serviceArea ?? '—'} label="Service area" />
              <Chip value={TRAINING[volunteer.trainingStatus] ?? volunteer.trainingStatus} label="Training" />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-[28px] bg-white p-5 ring-1 ring-border sm:p-7 lg:col-span-5">
          <p className={cn(eyebrowClass(), 'text-[var(--crop-green-600)]')}>Before every visit</p>
          <ul className="flex flex-col gap-4">
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
      </div>

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
    <div className={cn('flex min-h-[84px] max-w-[16rem] min-w-[84px] flex-col justify-between gap-2 rounded-2xl p-3', dark ? 'bg-[var(--crop-ink)]/80 backdrop-blur-md' : 'bg-white/95 text-[var(--crop-ink)]')}>
      <span className="line-clamp-2 text-base leading-tight font-semibold tracking-tight">{value}</span>
      <span className="text-[9px] leading-tight font-semibold tracking-[0.14em] uppercase opacity-75">{label}</span>
    </div>
  );
}
