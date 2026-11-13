import type { Metadata } from 'next';
import {
  ArrowUpRight,
  BadgeIndianRupee,
  Bug,
  CircleAlert,
  CloudSun,
  FlaskConical,
  Info,
  Landmark,
  MessageSquareText,
  Microscope,
  PhoneCall,
  Store,
  TrendingUp,
  Umbrella,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SmoothLink } from '@/components/marketing/home/smooth-link';
import { GOV_RESOURCE_GROUPS, RESOURCES_LAST_CHECKED, shortDate, type GovResource, type ResourceIcon } from '@/components/marketing/legal/content';
import { PageIntro } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: 'Government farming resources',
  description:
    'Official Government of India websites and helplines for farmers — PM-KISAN, crop insurance (PMFBY), Soil Health Card, e-NAM, Agmarknet, IMD weather, mKisan and the Kisan Call Centre (1800-180-1551).',
};

const ICONS: Record<ResourceIcon, LucideIcon> = {
  income: BadgeIndianRupee,
  insurance: Umbrella,
  soil: FlaskConical,
  protection: Bug,
  market: Store,
  prices: TrendingUp,
  weather: CloudSun,
  sms: MessageSquareText,
  helpline: PhoneCall,
  kvk: Microscope,
  ministry: Landmark,
};

function ResourceCard({ resource }: { resource: GovResource }) {
  const Icon = ICONS[resource.icon];
  const host = resource.url ? new URL(resource.url).hostname.replace(/^www\./, '') : null;
  return (
    <li data-reveal className="flex flex-col gap-4 rounded-[24px] bg-white p-5 ring-1 ring-border sm:p-6 sm:last:odd:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
        {resource.url ? (
          <Badge variant="secondary" className="tracking-wide uppercase">
            Official site
          </Badge>
        ) : (
          <Badge variant="outline" className="tracking-wide text-muted-foreground uppercase">
            Link unavailable
          </Badge>
        )}
      </div>
      <div>
        <h3 className="text-lg leading-snug font-semibold">{resource.name}</h3>
        <p lang="hi" className="mt-0.5 text-sm text-muted-foreground">
          {resource.hindi}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{resource.description}</p>
      {resource.phone && (
        <a
          href={`tel:${resource.phone.tel}`}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-[var(--crop-green-800)] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--crop-green-900)]"
        >
          <PhoneCall className="size-4" />
          {resource.phone.label}: {resource.phone.display}
        </a>
      )}
      {resource.linkNote && (
        <p className="flex gap-2 rounded-xl bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <CircleAlert className="mt-px size-3.5 shrink-0" />
          {resource.linkNote}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-4">
        {resource.url && host && (
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1 text-sm font-semibold text-[var(--crop-green-800)] hover:underline"
          >
            {host}
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            <span className="sr-only"> — {resource.name} official website (opens in a new tab)</span>
          </a>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          Last checked <time dateTime={resource.checked}>{shortDate(resource.checked)}</time>
        </span>
      </div>
    </li>
  );
}

export default function ResourcesPage() {
  return (
    <>
      <PageIntro
        eyebrow="Resources"
        title="Government farming resources"
        text="Official websites and helplines for schemes, crop insurance, soil testing, market prices, weather and expert advice — in one place, explained in a line each."
      />

      <section className="mx-auto max-w-[88rem] px-4 pb-4 sm:px-6 lg:px-8">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <div data-reveal className="flex gap-4 rounded-[24px] bg-white p-5 ring-1 ring-border sm:p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
              <Info className="size-5" />
            </span>
            <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
              <h2 className="text-base font-semibold text-foreground">CropAI is an independent project</h2>
              <p>
                We are not affiliated with, or endorsed by, the Government of India or any of its departments. Scheme rules, eligibility and deadlines come only from the
                official websites below — check there, or with your local agriculture office, before you apply.
              </p>
            </div>
          </div>

          <div
            data-reveal
            className="relative flex flex-col justify-between gap-5 overflow-hidden rounded-[24px] bg-gradient-to-br from-[var(--crop-green-800)] via-[var(--crop-green-900)] to-[var(--crop-green-950)] p-5 text-white sm:p-6"
          >
            <div className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-[var(--crop-green-500)]/25 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold tracking-[0.22em] text-[var(--crop-green-200)] uppercase">Need advice now?</p>
              <h2 className="mt-2 text-lg font-semibold">Kisan Call Centre — free call</h2>
              <p className="mt-1 text-sm leading-relaxed text-white/75">Agriculture experts answer in your language, 6 am to 10 pm, every day.</p>
            </div>
            <a
              href="tel:18001801551"
              className="relative inline-flex h-12 w-fit items-center gap-2 rounded-2xl bg-white px-5 text-[15px] font-semibold tracking-wide text-[var(--crop-ink)] shadow-lg transition-colors hover:bg-[var(--crop-green-100)]"
            >
              <PhoneCall className="size-4" /> 1800-180-1551
            </a>
          </div>
        </div>

        <nav aria-label="Resource categories" data-reveal className="mt-6 flex flex-wrap gap-2">
          {GOV_RESOURCE_GROUPS.map((group) => (
            <SmoothLink
              key={group.id}
              href={`#${group.id}`}
              className="rounded-full bg-white px-3.5 py-1.5 text-[13px] font-medium text-foreground/75 ring-1 ring-border transition-colors hover:bg-[var(--crop-green-100)] hover:text-[var(--crop-green-900)]"
            >
              {group.title}
            </SmoothLink>
          ))}
        </nav>
      </section>

      <div className="mx-auto max-w-[88rem] px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        {GOV_RESOURCE_GROUPS.map((group, index) => (
          <section
            key={group.id}
            id={group.id}
            aria-labelledby={`${group.id}-title`}
            className="grid scroll-mt-24 gap-5 border-t border-border py-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10"
          >
            <div data-reveal className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--crop-green-600)] tabular-nums">{String(index + 1).padStart(2, '0')}</span>
              <h2 id={`${group.id}-title`} className="text-2xl font-semibold tracking-[-0.03em]">
                {group.title}
              </h2>
              <p lang="hi" className="text-sm text-muted-foreground">
                {group.hindi}
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {group.resources.map((resource) => (
                <ResourceCard key={resource.name} resource={resource} />
              ))}
            </ul>
          </section>
        ))}
        <p className="border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
          Every link on this page was opened and checked on <time dateTime={RESOURCES_LAST_CHECKED.iso}>{RESOURCES_LAST_CHECKED.label}</time>. Government websites change — if a
          link stops working, ask your local agriculture office or call the Kisan Call Centre.
        </p>
      </div>
    </>
  );
}
