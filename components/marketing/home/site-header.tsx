'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu } from 'lucide-react';
import { useScroll } from '@/animations/hooks/use-scroll';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Logo } from './brand';
import { NAV_LINKS } from './content';
import { SmoothLink } from './smooth-link';

export function SiteHeader({ advisorHref }: { advisorHref: string }) {
  const scrolled = useScroll(24);
  const pathname = usePathname();
  const active = NAV_LINKS.find((l) => (l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)))?.href ?? '';

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500',
        scrolled ? 'bg-[var(--crop-cream)]/80 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-xl' : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-[88rem] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <SmoothLink href={pathname === '/' ? '#top' : '/'} aria-label="Home">
          <Logo />
        </SmoothLink>

        <nav aria-label="Main" className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((link) => (
            <SmoothLink
              key={link.href}
              href={link.href}
              className={cn(
                'relative py-1 text-[11px] font-semibold tracking-[0.16em] text-foreground/65 uppercase transition-colors hover:text-foreground',
                'after:absolute after:inset-x-0 after:-bottom-1 after:h-[2px] after:origin-left after:rounded-full after:bg-[var(--crop-green-600)] after:transition-transform after:duration-300',
                active === link.href ? 'text-foreground after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100',
              )}
            >
              {link.label}
            </SmoothLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={advisorHref}
            className={cn(buttonVariants({ size: 'lg' }), 'hidden h-10 rounded-xl px-4 text-[11px] font-semibold tracking-[0.14em] uppercase sm:inline-flex')}
          >
            Try AI Advisor <ArrowRight />
          </Link>

          <Sheet>
            <SheetTrigger
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'md:hidden')}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="theme-crop w-[300px]">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
                {NAV_LINKS.map((link) => (
                  <SheetClose
                    key={link.href}
                    render={
                      <SmoothLink
                        href={link.href}
                        className={cn(
                          'rounded-lg px-3 py-2.5 text-base font-medium transition-colors hover:bg-muted',
                          active === link.href ? 'text-[var(--crop-green-800)]' : 'text-foreground/75',
                        )}
                      />
                    }
                  >
                    {link.label}
                  </SheetClose>
                ))}
                <Separator className="my-3" />
                <Link href={advisorHref} className={cn(buttonVariants({ size: 'lg' }), 'h-11 rounded-full')}>
                  Try AI Advisor <ArrowRight />
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
