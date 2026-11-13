import { Manrope } from 'next/font/google';
import { LogOut } from 'lucide-react';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { WorkspaceMenu } from '@/components/workspace/workspace-menu';
import { brand } from '@/config/brand';
import { requireVolunteer } from '@/server/auth/dal';
import { VolunteerHeader } from './volunteer-nav';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata = { title: { default: 'Volunteer', template: `%s · ${brand.name} Volunteer` }, robots: { index: false } };

export default async function VolunteerLayout({ children }: { children: React.ReactNode }) {
  await requireVolunteer();
  return (
    <div className={`theme-crop ${manrope.variable} flex min-h-dvh flex-1 flex-col bg-[var(--crop-cream)] antialiased`}>
      <VolunteerHeader>
        <WorkspaceMenu current="volunteer" className="h-9 px-3 text-xs" />
        <SignOutButton className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[11px] font-semibold tracking-[0.12em] text-foreground/70 uppercase ring-1 ring-border transition-colors hover:bg-white" title="Sign out">
          <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
        </SignOutButton>
      </VolunteerHeader>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col px-4 pt-6 pb-10 sm:px-6 lg:px-8 lg:pt-10">{children}</main>
    </div>
  );
}
