'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SmoothLink } from '@/components/marketing/home/smooth-link';
import { cn } from '@/lib/utils';

export interface TocItem {
  id: string;
  title: string;
}

/** Offset of the fixed header plus breathing room, matching SmoothLink's scroll offset. */
const ACTIVE_OFFSET = 140;

/**
 * "On this page" navigation for the legal pages: a collapsible list on phones and a sticky list
 * with the current section highlighted on desktop. Links glide with Lenis via SmoothLink.
 */
export function LegalToc({ items }: { items: readonly TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = items[0]?.id ?? '';
      for (const item of items) {
        const element = document.getElementById(item.id);
        if (element && element.getBoundingClientRect().top <= ACTIVE_OFFSET) current = item.id;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && items.length) current = items[items.length - 1].id;
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [items]);

  const number = (index: number) => String(index + 1).padStart(2, '0');

  return (
    <>
      {/* Phones and tablets: collapsible list above the content */}
      <details ref={detailsRef} className="group rounded-[24px] bg-white ring-1 ring-border lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-3">
            <span className="text-xs font-semibold tracking-[0.22em] text-[var(--crop-green-600)] uppercase">On this page</span>
            <span className="text-xs font-medium text-muted-foreground">{items.length} sections</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform duration-300 group-open:rotate-180" />
        </summary>
        <ol className="flex flex-col gap-0.5 border-t border-border px-3 py-3">
          {items.map((item, index) => (
            <li key={item.id}>
              <SmoothLink
                href={`#${item.id}`}
                onClick={() => detailsRef.current?.removeAttribute('open')}
                className="flex gap-3 rounded-xl px-2 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="w-5 shrink-0 pt-px text-xs font-semibold text-[var(--crop-green-600)] tabular-nums">{number(index)}</span>
                {item.title}
              </SmoothLink>
            </li>
          ))}
        </ol>
      </details>

      {/* Desktop: sticky list with the section in view highlighted */}
      <nav aria-label="On this page" className="hidden lg:block">
        <p className="text-xs font-semibold tracking-[0.22em] text-[var(--crop-green-600)] uppercase">On this page</p>
        <ol className="mt-4 flex flex-col border-l border-border">
          {items.map((item, index) => (
            <li key={item.id}>
              <SmoothLink
                href={`#${item.id}`}
                aria-current={active === item.id ? 'location' : undefined}
                className={cn(
                  '-ml-px flex gap-3 border-l-2 py-1.5 pl-4 text-sm leading-snug transition-colors duration-300',
                  active === item.id
                    ? 'border-[var(--crop-green-600)] font-semibold text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="w-5 shrink-0 pt-px text-xs font-semibold text-[var(--crop-green-600)] tabular-nums">{number(index)}</span>
                {item.title}
              </SmoothLink>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
