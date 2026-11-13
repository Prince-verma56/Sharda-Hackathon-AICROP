'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveLangCookie } from '@/lib/i18n/lang-cookie';
import { cn } from '@/lib/utils';

/**
 * हिं / EN switch shown in the farmer header on every page. Saves the farmer's language (same
 * profile API as the profile page) and re-renders the current page in place — reports, Mitra,
 * history, everything server-rendered follows it.
 */
export function LanguageToggle({ lang, className }: { lang: 'hi' | 'en'; className?: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(lang);
  const [pending, startTransition] = useTransition();

  async function choose(next: 'hi' | 'en') {
    if (next === current || pending) return;
    const previous = current;
    setCurrent(next);
    const res = await fetch('/api/v1/farmer/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: next }) }).catch(() => null);
    if (!res?.ok) {
      setCurrent(previous);
      return;
    }
    saveLangCookie(next);
    startTransition(() => router.refresh());
  }

  return (
    <div role="group" aria-label="भाषा / Language" className={cn('inline-flex h-9 items-center rounded-full bg-white p-1 ring-1 ring-border', pending && 'opacity-70', className)}>
      {(
        [
          ['hi', 'हिं', 'हिंदी'],
          ['en', 'EN', 'English'],
        ] as const
      ).map(([value, short, full]) => (
        <button
          key={value}
          type="button"
          aria-pressed={current === value}
          aria-label={full}
          title={full}
          onClick={() => void choose(value)}
          className={cn(
            'h-7 min-w-9 rounded-full px-2.5 text-xs font-semibold transition-colors',
            current === value ? 'bg-[var(--crop-green-800)] text-white' : 'text-foreground/60 hover:text-foreground',
          )}
        >
          {short}
        </button>
      ))}
    </div>
  );
}
