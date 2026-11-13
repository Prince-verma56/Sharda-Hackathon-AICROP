'use client';

import { useTransition } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut, signOutEverywhere } from '@/server/auth/account-actions';

export function AccountControls({ lang }: { lang: string }) {
  const hi = lang === 'hi';
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" className="h-12 rounded-2xl bg-white" disabled={pending} onClick={() => start(() => signOut())}>
        {pending ? <Loader2 className="animate-spin" /> : <LogOut />} {hi ? 'लॉग आउट' : 'Log out'}
      </Button>
      <Button variant="destructive" className="h-12 rounded-2xl" disabled={pending} onClick={() => start(() => signOutEverywhere())}>
        {hi ? 'सभी डिवाइस से लॉग आउट' : 'Log out of all devices'}
      </Button>
    </div>
  );
}
