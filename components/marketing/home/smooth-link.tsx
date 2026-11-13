'use client';

import type { ComponentProps, MouseEvent } from 'react';
import Link from 'next/link';
import { useSmoothScroll } from '@/animations/smooth-scroll';

/** Anchor that glides to in-page sections with Lenis (falls back to native behaviour). */
export function SmoothLink({ href, onClick, ...props }: ComponentProps<'a'> & { href: string }) {
  const { lenis } = useSmoothScroll();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || !href.startsWith('#')) return;
    const target = href === '#top' ? 0 : document.querySelector<HTMLElement>(href);
    if (target === null) return;
    event.preventDefault();
    if (lenis) {
      lenis.scrollTo(target, { offset: -84, duration: 1.4 });
    } else if (target === 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      target.scrollIntoView({ behavior: 'smooth' });
    }
    history.replaceState(null, '', href === '#top' ? window.location.pathname : href);
  }

  if (!href.startsWith('#')) return <Link href={href} onClick={onClick} {...props} />;
  return <a href={href} onClick={handleClick} {...props} />;
}
