import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Bug, CloudSun, Leaf, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FEATURES } from './content';
import { SmoothLink } from './smooth-link';

const FEATURE_ICONS = { leaf: Leaf, bug: Bug, cloud: CloudSun, sparkles: Sparkles } as const;

/** One headline word inside a clipping mask, animated by the hero timeline. */
function Word({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className="inline-block overflow-hidden pb-[0.06em] align-bottom">
      <span data-hero-word className={cn('inline-block', accent && 'text-[var(--crop-green-500)]')}>
        {children}
      </span>
    </span>
  );
}

export function Hero({ advisorHref }: { advisorHref: string }) {
  return (
    <section id="top" className="relative pt-[88px] sm:pt-[96px]">
      <div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
        {/* ---------- Headline row ---------- */}
        {/*
          Layout is fixed BEFORE any animation runs: explicit lines that never auto-wrap,
          and the pill reserves its full size (it is revealed with clip-path, not width).
          Mobile: SMARTER [pill] / FARMING / GREENER / TOMORROW. sm+: two lines.
        */}
        <div className="grid items-start gap-6 pt-6 xl:grid-cols-[1fr_auto] xl:gap-10 lg:pt-10">
          <h1
            data-hero-title
            className="text-[clamp(2.9rem,13.2vw,4.6rem)] leading-[0.92] font-semibold tracking-[-0.045em] whitespace-nowrap uppercase sm:text-[clamp(2.5rem,7.1vw,6.4rem)] xl:text-[clamp(4rem,6.15vw,6.6rem)]"
          >
            <span className="flex flex-nowrap items-center gap-x-[0.2em]">
              <Word>Smarter</Word>
              <span
                data-hero-pill
                className="relative inline-block h-[0.74em] w-[1.9em] shrink-0 overflow-hidden rounded-full align-middle ring-1 ring-black/5 sm:w-[2.2em]"
              >
                <Image
                  src="/images/home/hero.jpg"
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1024px) 300px, 160px"
                  data-hero-pill-image
                  className="object-cover object-[55%_62%]"
                />
              </span>
              <span className="hidden sm:inline-block">
                <Word>Farming</Word>
              </span>
            </span>
            <span className="mt-[0.06em] flex sm:hidden">
              <Word>Farming</Word>
            </span>
            <span className="mt-[0.06em] flex flex-col sm:flex-row sm:gap-x-[0.2em]">
              <Word>Greener</Word>
              <Word accent>Tomorrow</Word>
            </span>
          </h1>

          <div className="flex items-start justify-between gap-6 xl:flex-col xl:items-end xl:pt-3">
            <p
              data-hero-fade
              className="max-w-[15rem] text-[11px] leading-relaxed font-semibold tracking-[0.18em] text-foreground/70 uppercase xl:text-right"
            >
              Turning every leaf photo
              <br className="hidden xl:block" /> into early action
            </p>
            <div data-hero-fade className="flex gap-1.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} data-hero-dot className="size-3 rounded-[3px] bg-[var(--crop-green-500)]/80" />
              ))}
            </div>
          </div>
        </div>

        {/* ---------- Image card ---------- */}
        <div
          data-hero-card
          className="relative mt-8 overflow-hidden rounded-[28px] bg-[var(--crop-green-900)] sm:mt-10 lg:mt-12"
        >
          <div className="relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-[16/6.4]">
            <div data-hero-card-image className="absolute inset-0">
              <div data-parallax="0.14" className="absolute -inset-y-[10%] inset-x-0">
                <Image
                  src="/images/home/field-band.jpg"
                  alt="Aerial view of green crop fields"
                  fill
                  priority
                  sizes="(min-width: 1408px) 1376px, 100vw"
                  className="object-cover object-[50%_45%]"
                />
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-black/20" />

            <div data-hero-card-label className="absolute top-5 left-5 text-base font-semibold tracking-tight text-white sm:top-7 sm:left-8 sm:text-xl">
              CROPAI<sup className="ml-0.5 text-[0.55em]">®</sup>
            </div>

            <div className="absolute inset-x-4 bottom-4 flex flex-col gap-4 sm:inset-x-7 sm:bottom-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex gap-2.5">
                  <div data-hero-chip className="flex size-[84px] flex-col justify-between rounded-2xl bg-[var(--crop-ink)]/85 p-3 text-white backdrop-blur-md sm:size-[96px]">
                    <span className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">59</span>
                    <span className="text-[9px] leading-tight font-semibold tracking-[0.14em] uppercase opacity-80">Crops covered</span>
                  </div>
                  <div data-hero-chip className="flex size-[84px] flex-col justify-between rounded-2xl bg-white/95 p-3 text-[var(--crop-ink)] backdrop-blur-md sm:size-[96px]">
                    <span className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">387</span>
                    <span className="text-[9px] leading-tight font-semibold tracking-[0.14em] uppercase opacity-70">Diseases &amp; pests</span>
                  </div>
                </div>
                <p data-hero-copy className="max-w-sm text-sm leading-relaxed text-white/90">
                  Photograph one leaf, choose your crop and get an AI screening in under a second — explained in simple
                  words and by voice, so you can act early and confirm with an expert.
                </p>
              </div>

              <div data-hero-cta className="flex flex-wrap gap-2">
                <Link
                  href={advisorHref}
                  className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-[12px] font-semibold tracking-[0.12em] text-[var(--crop-ink)] uppercase shadow-lg transition-colors hover:bg-[var(--crop-green-100)]"
                >
                  Try the AI advisor
                  <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
                <SmoothLink
                  href="#how-it-works"
                  className="inline-flex h-12 items-center rounded-2xl border border-white/35 px-5 text-[12px] font-semibold tracking-[0.12em] text-white uppercase backdrop-blur-md transition-colors hover:bg-white/10"
                >
                  How it works
                </SmoothLink>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- Feature row ---------- */}
        <div id="features" className="scroll-mt-28 py-8 sm:py-10">
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border/70 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = FEATURE_ICONS[feature.icon];
              return (
                <li key={feature.title} data-feature-item className="group flex flex-col gap-3 bg-[var(--crop-cream)] p-5 sm:p-6">
                  <span className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)] transition-transform duration-500 group-hover:-rotate-6">
                      <Icon className="size-5" strokeWidth={1.7} />
                    </span>
                    {feature.live ? (
                      <span className="text-[10px] font-semibold tracking-[0.16em] text-[var(--crop-green-600)] uppercase">Live</span>
                    ) : (
                      <Badge variant="secondary" className="h-5 text-[10px] tracking-[0.12em] uppercase">
                        Soon
                      </Badge>
                    )}
                  </span>
                  <span className="text-sm font-semibold tracking-tight sm:text-base">{feature.title}</span>
                  <span className="-mt-2 text-xs text-muted-foreground sm:text-sm">{feature.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
