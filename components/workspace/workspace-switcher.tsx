'use client';

import { useTransition } from 'react';
import { Check, ChevronsUpDown, HandHeart, Loader2, Plus, ShieldCheck, Sprout } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Workspace } from '@/lib/auth/redirects';
import { cn } from '@/lib/utils';
import { enableFarmerWorkspace, switchWorkspace } from '@/server/auth/workspace-actions';

const META: Record<Workspace, { icon: typeof Sprout; en: string; hi: string }> = {
  farmer: { icon: Sprout, en: 'Farmer', hi: 'किसान' },
  volunteer: { icon: HandHeart, en: 'Volunteer', hi: 'स्वयंसेवक' },
  admin: { icon: ShieldCheck, en: 'Admin', hi: 'प्रशासक' },
};

export interface WorkspaceSwitcherProps {
  current: Workspace;
  /** from database roles (server) */
  available: Workspace[];
  /** account has no FARMER role yet (FARMER is public, so it can be self-enabled) */
  canStartFarmer: boolean;
  lang?: 'en' | 'hi';
  className?: string;
}

/** Switches between the workspaces this account already has. The server re-checks every switch. */
export function WorkspaceSwitcher({ current, available, canStartFarmer, lang = 'en', className }: WorkspaceSwitcherProps) {
  const [pending, startTransition] = useTransition();
  const label = (w: Workspace) => (lang === 'hi' ? META[w].hi : META[w].en);
  const CurrentIcon = META[current].icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={lang === 'hi' ? 'कार्यक्षेत्र बदलें' : 'Switch workspace'}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-sm font-semibold ring-1 ring-border transition-colors hover:bg-muted',
          className,
        )}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <CurrentIcon className="size-4 text-[var(--crop-green-600)]" />}
        {label(current)}
        <ChevronsUpDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{lang === 'hi' ? 'कार्यक्षेत्र बदलें' : 'Switch workspace'}</DropdownMenuLabel>
          {available.map((w) => {
            const Icon = META[w].icon;
            return (
              <DropdownMenuItem
                key={w}
                disabled={pending}
                onClick={() => {
                  if (w !== current) startTransition(() => switchWorkspace(w));
                }}
              >
                <Icon /> {label(w)}
                {w === current && <Check className="ml-auto" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        {canStartFarmer && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={pending} onClick={() => startTransition(() => enableFarmerWorkspace())}>
                <Plus /> {lang === 'hi' ? 'किसान ऐप शुरू करें' : 'Start using the farmer app'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
