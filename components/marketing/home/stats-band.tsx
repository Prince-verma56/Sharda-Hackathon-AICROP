import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { STATS, STATS_FOOTNOTE } from './content';

export function StatsBand() {
  return (
    <section id="insights" className="scroll-mt-24 px-4 py-6 sm:px-6 lg:px-8">
      <div
        data-reveal="scale"
        className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] text-white shadow-[0_30px_70px_-40px_rgba(28,46,22,0.8)]"
      >
        <div data-parallax="0.15" className="absolute -inset-y-[25%] inset-x-0">
          <Image
            src="/images/home/field-band.jpg"
            alt=""
            fill
            sizes="(min-width: 1280px) 1280px, 100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--crop-green-950)]/85 via-[var(--crop-green-900)]/65 to-[var(--crop-green-950)]/55" />

        <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {STATS.map((stat, index) => (
            <div key={stat.label} className="contents">
              {index > 0 && (
                <>
                  <Separator orientation="vertical" className="my-8 hidden bg-white/25 sm:block" />
                  <Separator className="mx-auto w-2/3 bg-white/20 sm:hidden" />
                </>
              )}
              <div className="flex flex-col items-center justify-center gap-1 px-6 py-9 sm:py-12">
                <span className="text-5xl font-semibold tracking-[-0.03em] tabular-nums sm:text-[3.4rem]">
                  <span data-count={stat.value}>{stat.value}</span>
                  {stat.suffix}
                </span>
                <span className="text-sm text-white/80">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-7xl px-2 text-[11px] leading-relaxed text-muted-foreground">{STATS_FOOTNOTE}</p>
    </section>
  );
}
