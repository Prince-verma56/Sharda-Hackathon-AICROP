import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Bug, CloudSun, Leaf, Play, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LeafMark } from './brand';
import { FEATURES } from './content';
import { SmoothLink } from './smooth-link';

const FEATURE_ICONS = { leaf: Leaf, bug: Bug, cloud: CloudSun, sparkles: Sparkles } as const;

export function Hero({ advisorHref }: { advisorHref: string }) {
  return (
    <section id="top" className="relative isolate overflow-hidden pt-[72px]">
      {/* Background photograph: full-bleed on mobile (lower half), right-side on desktop */}
      <div
        data-hero-media
        className="absolute inset-x-0 bottom-0 -z-10 h-[58%] overflow-hidden lg:top-0 lg:left-auto lg:h-full lg:w-[74%] lg:rounded-bl-[48px] lg:rounded-tl-[340px]"
      >
        <div data-parallax="0.18" className="absolute -inset-y-[8%] inset-x-0">
          <Image
            src="/images/home/hero.jpg"
            alt="Crop sprayers working across a lush green field at sunrise"
            fill
            priority
            sizes="(min-width: 1024px) 74vw, 100vw"
            className="object-cover object-[60%_center]"
          />
        </div>
        {/* soft fades into the cream page colour */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--crop-cream)_0%,transparent_32%)] lg:bg-[linear-gradient(90deg,var(--crop-cream)_0%,color-mix(in_srgb,var(--crop-cream)_82%,transparent)_22%,color-mix(in_srgb,var(--crop-cream)_25%,transparent)_48%,transparent_70%)]" />
        <div className="absolute inset-x-0 top-0 hidden h-48 bg-gradient-to-b from-[var(--crop-cream)]/70 to-transparent lg:block" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--crop-cream)]/80 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/50 to-transparent mix-blend-soft-light" />
      </div>

      {/* Decorative blurred leaf, bottom-left */}
      <div data-parallax="-0.25" className="pointer-events-none absolute -bottom-10 -left-16 -z-10 hidden md:block">
        <LeafMark className="size-64 -rotate-[24deg] text-[var(--crop-green-600)]/35 blur-[6px]" />
      </div>

      <div className="mx-auto grid min-h-[640px] max-w-7xl px-4 pb-48 sm:px-6 lg:min-h-[760px] lg:px-8 lg:pb-44">
        <div className="flex max-w-2xl flex-col justify-center pt-10 lg:pt-0">
          <h1 className="text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-6xl lg:text-[4.25rem] lg:whitespace-nowrap">
            <span data-hero-line className="block">Smarter Farming.</span>
            <span data-hero-line className="block text-[var(--crop-green-600)]">Greener Tomorrow.</span>
          </h1>
          <p data-hero-line className="mt-6 max-w-sm text-base leading-relaxed text-muted-foreground sm:text-lg">
            AI-powered leaf diagnosis for healthier crops, earlier action and a more sustainable harvest.
          </p>
          <div data-hero-line className="mt-9 flex flex-wrap items-center gap-3">
            <Link href={advisorHref} className={cn(buttonVariants({ size: 'lg' }), 'h-11 rounded-full px-6 text-sm shadow-lg shadow-[var(--crop-green-900)]/20')}>
              Get Started <ArrowRight />
            </Link>
            <SmoothLink
              href="#how-it-works"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 rounded-full bg-white/70 px-5 text-sm backdrop-blur')}
            >
              <span className="grid size-6 place-items-center rounded-full bg-[var(--crop-green-900)] text-white">
                <Play className="size-3 fill-current" />
              </span>
              Watch Demo
            </SmoothLink>
          </div>
        </div>
      </div>

      <div data-hero-line className="absolute top-[120px] right-8 hidden border-l-2 border-[var(--crop-green-600)]/70 pl-4 text-sm leading-snug font-medium text-foreground/80 lg:block xl:right-[max(2rem,calc((100vw-80rem)/2+2rem))]">
        AI for
        <br />
        Modern Agriculture
      </div>

      {/* Feature strip overlapping the hero */}
      <div id="features" className="relative z-10 mx-auto -mt-32 max-w-7xl scroll-mt-28 px-4 pb-6 sm:px-6 lg:px-8">
        <Card
          data-feature-strip
          className="grid grid-cols-2 gap-0 rounded-3xl border-0 bg-white/85 py-0 shadow-[0_24px_60px_-28px_rgba(28,46,22,0.35)] ring-black/5 backdrop-blur-xl lg:grid-cols-4"
        >
          {FEATURES.map((feature, index) => {
            const Icon = FEATURE_ICONS[feature.icon];
            return (
              <div
                key={feature.title}
                data-feature-item
                className={cn(
                  'group flex flex-col items-start gap-3 px-4 py-5 sm:flex-row sm:items-center sm:gap-4 sm:px-7 sm:py-6 lg:py-8',
                  index % 2 === 1 && 'border-l border-border/70',
                  index >= 2 && 'border-t border-border/70 lg:border-t-0',
                  index === 2 && 'lg:border-l',
                )}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)] transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:rotate-[-6deg]">
                  <Icon className="size-6" strokeWidth={1.6} />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                    {feature.title}
                    {!feature.live && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        Soon
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{feature.text}</span>
                </span>
              </div>
            );
          })}
        </Card>
      </div>
    </section>
  );
}
