import { cn } from '@/lib/utils';

/**
 * The public site's type system, shared by the app screens (farmer, Mitra, volunteer):
 * a small tracked eyebrow, a display heading with one green accent phrase, a muted description.
 * Devanagari keeps normal letter-spacing and taller lines (matras need the room; uppercase and
 * wide tracking do nothing useful for Hindi).
 */
export function eyebrowClass(lang?: string) {
  return cn('font-semibold', lang === 'hi' ? 'text-[13px] tracking-normal' : 'text-[11px] tracking-[0.18em] uppercase');
}

/** Small label used inside cards and chips (9–10 px tracked caps in English). */
export function labelClass(lang?: string) {
  return cn('font-semibold', lang === 'hi' ? 'text-[12px] tracking-normal' : 'text-[10px] tracking-[0.16em] uppercase');
}

export function displayClass(lang?: string) {
  return lang === 'hi' ? 'leading-[1.15] font-semibold tracking-tight' : 'leading-[0.92] font-semibold tracking-[-0.045em] uppercase';
}

export function Accent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-[var(--crop-green-500)]', className)}>{children}</span>;
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  lang,
  className,
}: {
  eyebrow?: React.ReactNode;
  /** compose with <Accent> for the green phrase */
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  lang?: string;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className={cn(eyebrowClass(lang), 'text-[var(--crop-green-600)]')}>{eyebrow}</p>}
        <h1 className={cn('mt-2', lang === 'hi' ? 'text-[clamp(2rem,5.5vw,3.3rem)]' : 'text-[clamp(2.2rem,6vw,4rem)]', displayClass(lang))}>{title}</h1>
        {description && <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground lg:text-lg">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
