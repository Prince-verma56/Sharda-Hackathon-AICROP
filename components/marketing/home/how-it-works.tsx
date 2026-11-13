import { Cpu, Sprout, UploadCloud } from 'lucide-react';
import { Eyebrow } from './about';
import { STEPS } from './content';

const STEP_ICONS = { upload: UploadCloud, cpu: Cpu, sprout: Sprout } as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Eyebrow center>How it works</Eyebrow>
          <h2 data-reveal className="text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem]">
            Simple Steps. Big Impact.
          </h2>
        </div>

        <ol className="relative mt-16 grid gap-12 md:grid-cols-3 md:gap-6">
          {/* connector line behind the steps (desktop) */}
          <span
            aria-hidden
            data-line-draw
            className="absolute top-[86px] right-[calc(16.66%+40px)] left-[calc(16.66%+40px)] hidden h-px origin-left bg-gradient-to-r from-[var(--crop-green-200)] via-[var(--crop-green-500)]/50 to-[var(--crop-green-200)] md:block"
          />
          {STEPS.map((step, index) => {
            const Icon = STEP_ICONS[step.icon];
            return (
              <li key={step.title} data-step className="group relative flex flex-col items-center text-center">
                <span className="grid size-7 place-items-center rounded-full bg-[var(--crop-green-200)] text-xs font-bold text-[var(--crop-green-900)]">
                  {index + 1}
                </span>
                <span className="relative mt-5 grid size-[72px] place-items-center rounded-2xl bg-[var(--crop-cream)] text-[var(--crop-ink)] ring-1 ring-border transition-all duration-500 group-hover:-translate-y-1 group-hover:bg-white group-hover:text-[var(--crop-green-600)] group-hover:shadow-lg">
                  <Icon className="size-9" strokeWidth={1.3} />
                </span>
                <h3 className="mt-6 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-[15rem] text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
