import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, CalendarCheck, Check, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONTACT_PENDING, contactEmail } from './content';
import { LegalToc } from './legal-toc';

/** Shared building blocks for the privacy policy, terms and data-rights pages. */

export interface LegalSectionItem {
  id: string;
  title: string;
  subtitle?: string;
  content: ReactNode;
}

/** "Last updated" and scope chips shown under the page intro. */
export function LegalMeta({ updated, items = [] }: { updated: { iso: string; label: string }; items?: readonly string[] }) {
  return (
    <div className="mx-auto max-w-[88rem] px-4 pb-8 sm:px-6 lg:px-8">
      <ul data-reveal className="flex flex-wrap gap-2 text-xs font-medium text-foreground/75 sm:text-[13px]">
        <li className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 ring-1 ring-border">
          <CalendarCheck className="size-3.5 text-[var(--crop-green-600)]" />
          Last updated <time dateTime={updated.iso}>{updated.label}</time>
        </li>
        {items.map((item) => (
          <li key={item} className="inline-flex items-center rounded-full bg-white px-3.5 py-1.5 ring-1 ring-border">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Two-column document: numbered sections on the left, a sticky table of contents on the right
 * (desktop) or a collapsible list above the sections (phones).
 */
export function LegalDocument({ sections, intro, aside }: { sections: readonly LegalSectionItem[]; intro?: ReactNode; aside?: ReactNode }) {
  const toc = sections.map(({ id, title }) => ({ id, title }));
  return (
    <section className="mx-auto max-w-[88rem] px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12 xl:grid-cols-[minmax(0,52rem)_18rem] xl:justify-between">
        <aside className="lg:order-2">
          <div className="flex flex-col gap-8 lg:sticky lg:top-28">
            <LegalToc items={toc} />
            {aside && <div className="hidden lg:block">{aside}</div>}
          </div>
        </aside>
        <div className="flex min-w-0 flex-col gap-3 lg:order-1">
          {intro}
          {sections.map((section, index) => (
            <LegalSection key={section.id} id={section.id} index={index + 1} title={section.title} subtitle={section.subtitle}>
              {section.content}
            </LegalSection>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LegalSection({ id, index, title, subtitle, children }: { id: string; index: number; title: string; subtitle?: string; children: ReactNode }) {
  // The anchor (<section id>) stays untransformed; only the inner card is animated by data-reveal,
  // so table-of-contents jumps land exactly below the fixed header.
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28">
      <div data-reveal className="rounded-[24px] bg-white p-6 ring-1 ring-border sm:p-8">
        <header className="flex items-baseline gap-3">
          <span className="text-xs font-semibold text-[var(--crop-green-600)] tabular-nums">{String(index).padStart(2, '0')}</span>
          <div>
            <h2 id={`${id}-title`} className="text-xl font-semibold tracking-[-0.02em] sm:text-[1.4rem]">
              {title}
            </h2>
            {subtitle && (
              <p lang="hi" className="mt-0.5 text-sm text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </header>
        <div className="mt-4 flex flex-col gap-4 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </section>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <b className="font-semibold text-foreground">{children}</b>;
}

/** Inline link: internal routes use next/link, external sites open in a new tab. */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  const className = 'font-medium text-[var(--crop-green-800)] underline decoration-[var(--crop-green-200)] decoration-2 underline-offset-4 transition-colors hover:decoration-[var(--crop-green-600)]';
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  const external = href.startsWith('http');
  return (
    <a href={href} className={className} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

export function LegalList({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-[var(--crop-green-500)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Callout({ title, children, icon: Icon = Info, tone = 'soft' }: { title?: string; children: ReactNode; icon?: LucideIcon; tone?: 'soft' | 'strong' }) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-2xl p-4 text-sm leading-relaxed sm:p-5',
        tone === 'strong' ? 'bg-[var(--crop-green-900)] text-white/85' : 'bg-[var(--crop-green-100)] text-[var(--crop-green-900)]',
      )}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', tone === 'strong' ? 'text-[var(--crop-green-200)]' : 'text-[var(--crop-green-600)]')} />
      <div className="flex flex-col gap-1">
        {title && <b className={cn('font-semibold', tone === 'strong' ? 'text-white' : 'text-[var(--crop-green-950)]')}>{title}</b>}
        {children}
      </div>
    </div>
  );
}

/** The public contact address, or a clear "not yet published" note. */
export function ContactEmail() {
  const email = contactEmail();
  return email ? <TextLink href={`mailto:${email}`}>{email}</TextLink> : <span className="font-medium text-foreground">{CONTACT_PENDING}</span>;
}

/** Dark "at a glance" card that opens a legal document. */
export function LegalSummary({ title, points }: { title: string; points: readonly { title: string; text: string }[] }) {
  return (
    <div
      data-reveal="scale"
      className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[var(--crop-green-800)] via-[var(--crop-green-900)] to-[var(--crop-green-950)] p-6 text-white sm:p-8"
    >
      <div className="pointer-events-none absolute -top-28 -right-20 size-72 rounded-full bg-[var(--crop-green-500)]/25 blur-3xl" />
      <p className="relative text-xs font-semibold tracking-[0.22em] text-[var(--crop-green-200)] uppercase">{title}</p>
      <ul className="relative mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {points.map((point) => (
          <li key={point.title} className="flex gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/15 text-[var(--crop-green-200)]">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            <span className="flex flex-col gap-0.5">
              <b className="text-[15px] font-semibold">{point.title}</b>
              <span className="text-sm leading-relaxed text-white/75">{point.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Small card under the table of contents (desktop) pointing to related pages. */
export function LegalHelpCard({ title, text, links }: { title: string; text: string; links: readonly { label: string; href: string }[] }) {
  return (
    <div className="rounded-[24px] bg-white p-5 ring-1 ring-border">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="group flex items-center justify-between gap-2 text-sm font-semibold text-[var(--crop-green-800)]">
              {link.label}
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
