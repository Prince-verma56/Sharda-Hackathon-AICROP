'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Camera, FileText, Home, Mic, User } from 'lucide-react';
import { LanguageToggle } from '@/components/farmer/language-toggle';
import { Logo } from '@/components/marketing/home/brand';
import { t } from '@/lib/i18n/farmer';
import { cn } from '@/lib/utils';
import { stopSpeaking } from '@/lib/voice/speak';

function useItems(lang: string) {
  const pathname = usePathname();
  const tx = t(lang);
  const items = [
    { href: '/farmer', label: tx.home, icon: Home, exact: true },
    { href: '/farmer/scan', label: tx.scan, icon: Camera },
    { href: '/farmer/assistant', label: tx.mitra, icon: Mic },
    { href: '/farmer/history', label: tx.reports, icon: FileText },
    { href: '/farmer/profile', label: tx.profile, icon: User },
  ];
  return items.map((item) => ({
    ...item,
    active: item.exact ? pathname === item.href : pathname.startsWith(item.href) || (item.href === '/farmer/history' && pathname.startsWith('/farmer/diagnosis')),
  }));
}

/**
 * Top bar — the public site's header, adapted: logo, tracked-caps links with the green underline,
 * one primary action. On phones it keeps only the logo and the workspace switcher; the bottom
 * navigation carries the links.
 */
export function FarmerHeader({ lang, children }: { lang: string; children?: React.ReactNode }) {
  const items = useItems(lang).filter((i) => i.href !== '/farmer/scan');
  const tx = t(lang);
  const hi = lang === 'hi';
  const pathname = usePathname();
  // "Listen" uses the device's global speech engine: stop it whenever the farmer changes page.
  useEffect(() => stopSpeaking(), [pathname]);
  return (
    <header className="sticky top-0 z-40 bg-[var(--crop-cream)]/85 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-xl print:hidden">
      <div className="mx-auto flex h-16 max-w-[88rem] items-center justify-between gap-6 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <Link href="/farmer" aria-label={tx.home}>
          <Logo className="text-[1.2rem] lg:text-[1.35rem]" />
        </Link>

        <nav aria-label="Farmer" className="hidden items-center gap-9 lg:flex">
          {items.map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative py-1 font-semibold text-foreground/65 transition-colors hover:text-foreground',
                hi ? 'text-[14px]' : 'text-[11px] tracking-[0.16em] uppercase',
                'after:absolute after:inset-x-0 after:-bottom-1 after:h-[2px] after:origin-left after:rounded-full after:bg-[var(--crop-green-600)] after:transition-transform after:duration-300',
                active ? 'text-foreground after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle lang={hi ? 'hi' : 'en'} />
          {children}
          <Link
            href="/farmer/scan"
            className={cn(
              'group hidden h-10 items-center gap-2 rounded-xl bg-[var(--crop-green-800)] px-4 font-semibold text-white transition-colors hover:bg-[var(--crop-green-900)] lg:inline-flex',
              hi ? 'text-[14px]' : 'text-[11px] tracking-[0.14em] uppercase',
            )}
          >
            <Camera className="size-4" /> {tx.checkCrop}
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Phone navigation; the crop check — the main job — is the raised centre button. */
export function BottomNav({ lang }: { lang: string }) {
  const items = useItems(lang);
  const hi = lang === 'hi';
  return (
    <nav aria-label="Farmer" className="sticky bottom-0 z-40 border-t border-border/70 bg-[var(--crop-cream)]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden print:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon, active }) => {
          const primary = href === '/farmer/scan';
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 font-semibold',
                  hi ? 'text-[12px]' : 'text-[10px] tracking-[0.1em] uppercase',
                  active ? 'text-[var(--crop-green-800)]' : 'text-foreground/55',
                )}
              >
                {primary ? (
                  <span className={cn('grid size-10 place-items-center rounded-2xl text-white shadow-[0_10px_20px_-10px_rgba(28,46,22,0.8)]', active ? 'bg-[var(--crop-green-950)]' : 'bg-[var(--crop-green-800)]')}>
                    <Icon className="size-5" strokeWidth={2} />
                  </span>
                ) : (
                  <span className={cn('grid h-8 w-12 place-items-center rounded-full transition-colors', active && 'bg-[var(--crop-green-100)]')}>
                    <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                  </span>
                )}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
