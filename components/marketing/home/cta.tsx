import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CallToAction({ href }: { href: string }) {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div
        data-reveal="scale"
        className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-gradient-to-br from-[var(--crop-green-800)] via-[var(--crop-green-900)] to-[var(--crop-green-950)] px-7 py-12 text-white sm:px-12 sm:py-14"
      >
        {/* line-art leaf and sweeping curves */}
        <svg
          aria-hidden
          viewBox="0 0 520 260"
          className="pointer-events-none absolute right-0 bottom-0 h-full w-[70%] max-w-[560px] text-white/35"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <path data-draw d="M40 250C150 170 300 150 470 210" />
          <path data-draw d="M120 260C220 205 330 196 520 238" opacity=".6" />
          <path data-draw d="M392 238C364 166 386 92 476 40c22 76 4 150-84 198Z" />
          <path data-draw d="M392 238C420 172 446 112 476 40" />
          <path data-draw d="M392 238c-6 8-12 14-20 18" />
        </svg>
        <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-[var(--crop-green-500)]/25 blur-3xl" />

        <div className="relative flex max-w-xl flex-col gap-4">
          <h2 className="text-3xl leading-tight font-semibold tracking-[-0.03em] sm:text-[2.6rem]">
            Let&apos;s Build a
            <br />
            Smarter Agricultural Future
          </h2>
          <p className="text-sm text-white/80 sm:text-base">
            Join the farmers using CropAI to catch crop problems early and worry less.
          </p>
          <div className="mt-3">
            <Link
              href={href}
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'lg' }),
                'h-11 rounded-full bg-white px-6 text-[var(--crop-green-900)] hover:bg-white/90',
              )}
            >
              Start for Free <ArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
