import Image from 'next/image';
import { ArrowRight, Check, Leaf } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SmoothLink } from './smooth-link';

export function Eyebrow({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <p
      data-reveal
      className={cn(
        'flex items-center gap-3 text-xs font-semibold tracking-[0.22em] text-[var(--crop-green-600)] uppercase',
        center && 'justify-center',
      )}
    >
      {children}
      <span className="h-px w-10 bg-[var(--crop-green-600)]/50" />
    </p>
  );
}

export function About() {
  return (
    <section id="about" className="relative scroll-mt-24 overflow-hidden py-20 sm:py-28">
      {/* faint diagonal light, echoing the design */}
      <div className="pointer-events-none absolute -top-24 left-1/3 -z-10 h-[520px] w-[720px] -rotate-12 rounded-full bg-white/70 blur-3xl" />

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-20 lg:px-8">
        <div className="flex flex-col gap-6">
          <Eyebrow>About CropAI</Eyebrow>
          <h2 data-reveal className="text-4xl leading-[1.1] font-semibold tracking-[-0.03em] sm:text-5xl">
            Turning Data
            <br />
            into Better Harvests
          </h2>
          <p data-reveal className="max-w-md text-base leading-relaxed text-muted-foreground">
            CropAI uses a vision model trained on more than 238,000 plant photos to recognise diseases, pests and
            nutrient problems across 59 crops grown in India — so farmers can act before a small spot becomes a lost
            season.
          </p>
          <div data-reveal>
            <SmoothLink href="#how-it-works" className={cn(buttonVariants({ size: 'lg' }), 'h-11 rounded-full px-6')}>
              Learn More <ArrowRight />
            </SmoothLink>
          </div>
        </div>

        <div data-reveal="scale" className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] shadow-[0_30px_80px_-40px_rgba(28,46,22,0.6)]">
            <div data-parallax="0.1" className="absolute -inset-y-[10%] inset-x-0">
              <Image
                src="/images/home/leaf.jpg"
                alt="Close-up of a green leaf covered in dew"
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover object-[50%_40%]"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-[var(--crop-green-950)]/35 via-transparent to-transparent" />

            {/* scanning frame */}
            <div data-scan-frame className="absolute top-[18%] left-[16%] h-[58%] w-[38%]">
              {['top-0 left-0 border-t-2 border-l-2 rounded-tl-xl', 'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl', 'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl', 'right-0 bottom-0 border-r-2 border-b-2 rounded-br-xl'].map(
                (corner) => (
                  <span key={corner} className={cn('absolute size-7 border-white/90', corner)} />
                ),
              )}
              <span data-scan-line className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-gradient-to-r from-transparent via-[var(--crop-green-200)] to-transparent shadow-[0_0_14px_2px_rgba(201,227,179,0.8)]" />
            </div>
          </div>

          <Card
            data-float-card
            size="sm"
            className="absolute top-1/2 right-3 w-[212px] -translate-y-1/2 flex-row items-center gap-3 rounded-2xl bg-white/90 px-3.5 shadow-xl ring-black/5 backdrop-blur-md sm:right-6 lg:-right-6"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
              <Leaf className="size-5" strokeWidth={1.8} />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-sm font-semibold">Healthy Crop</span>
              <span className="text-xs text-muted-foreground">96% model score</span>
            </span>
            <span className="grid size-6 place-items-center rounded-full bg-[var(--crop-green-600)] text-white">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
          </Card>
        </div>
      </div>
    </section>
  );
}
