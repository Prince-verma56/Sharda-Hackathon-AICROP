'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/marketing/home/brand';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/volunteer', label: 'Home', exact: true },
  { href: '/volunteer/profile', label: 'Profile' },
  { href: '/resources', label: 'Resources' },
];

/** The public site's header pattern for the volunteer workspace (tracked caps + green underline). */
export function VolunteerHeader({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 bg-[var(--crop-cream)]/85 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[88rem] items-center justify-between gap-4 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <Link href="/volunteer" className="flex items-center gap-2.5" aria-label="Volunteer home">
          <Logo className="text-[1.2rem] lg:text-[1.35rem]" />
          <span className="hidden rounded-full bg-[var(--crop-green-100)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-[var(--crop-green-900)] uppercase sm:inline-flex">Volunteer</span>
        </Link>
        <nav aria-label="Volunteer" className="hidden items-center gap-9 md:flex">
          {LINKS.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative py-1 text-[11px] font-semibold tracking-[0.16em] text-foreground/65 uppercase transition-colors hover:text-foreground',
                  'after:absolute after:inset-x-0 after:-bottom-1 after:h-[2px] after:origin-left after:rounded-full after:bg-[var(--crop-green-600)] after:transition-transform after:duration-300',
                  active ? 'text-foreground after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">{children}</div>
      </div>
      {/* Phones: the same links as a compact row */}
      <nav aria-label="Volunteer" className="mx-auto flex max-w-[88rem] gap-6 overflow-x-auto px-4 pb-3 sm:px-6 md:hidden">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={cn('shrink-0 border-b-2 pb-1 text-[11px] font-semibold tracking-[0.16em] uppercase', active ? 'border-[var(--crop-green-600)] text-foreground' : 'border-transparent text-foreground/60')}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
