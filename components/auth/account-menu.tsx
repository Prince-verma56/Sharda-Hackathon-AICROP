'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { Loader2, LogOut, MonitorSmartphone, Settings2, UserRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { signOut, signOutEverywhere } from '@/server/auth/account-actions';

/**
 * Account menu shown in every workspace header (single-role farmers included): profile links and
 * sign-out. Sign-out revokes the session on the server, then returns to /login.
 */
export function AccountMenu({
  label,
  lang = 'en',
  links = [],
  className,
}: {
  /** e.g. the masked phone number or the person's name */
  label: string;
  lang?: 'hi' | 'en';
  links?: { href: string; label: string; icon?: 'profile' | 'settings' }[];
  className?: string;
}) {
  const [pending, start] = useTransition();
  const hi = lang === 'hi';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={hi ? 'खाता' : 'Account'}
        className={cn('grid size-9 place-items-center rounded-full bg-white text-foreground/80 ring-1 ring-border transition-colors hover:bg-muted', className)}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <UserRound className="size-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{label}</DropdownMenuLabel>
          {links.map((link) => (
            <DropdownMenuItem key={link.href} render={<Link href={link.href} />}>
              {link.icon === 'settings' ? <Settings2 /> : <UserRound />} {link.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={pending} onClick={() => start(() => signOut())}>
            <LogOut /> {hi ? 'लॉग आउट' : 'Sign out'}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={pending} onClick={() => start(() => signOutEverywhere())}>
            <MonitorSmartphone /> {hi ? 'सभी डिवाइस से लॉग आउट' : 'Sign out of all devices'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
