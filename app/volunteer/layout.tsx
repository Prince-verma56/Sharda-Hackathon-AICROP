import { Manrope } from 'next/font/google';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { LeafMark } from '@/components/marketing/home/brand';
import { WorkspaceMenu } from '@/components/workspace/workspace-menu';
import { brand } from '@/config/brand';
import { requireVolunteer } from '@/server/auth/dal';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata = { title: { default: 'Volunteer', template: `%s · ${brand.name} Volunteer` }, robots: { index: false } };

export default async function VolunteerLayout({ children }: { children: React.ReactNode }) {
  await requireVolunteer();
  return (
    <div className={`theme-crop ${manrope.variable} flex min-h-dvh flex-1 flex-col`}>
      <header className="sticky top-0 z-30 border-b border-border/60 bg-[var(--crop-cream)]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/volunteer" className="flex items-center gap-2 font-bold"><LeafMark className="size-6 text-[var(--crop-green-600)]" /> {brand.name} <span className="rounded-md bg-[var(--crop-green-100)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--crop-green-900)] uppercase">Volunteer</span></Link>
          <nav className="flex items-center gap-1 text-sm">
            <WorkspaceMenu current="volunteer" className="mr-1" />
            <Link href="/volunteer/profile" className="rounded-lg px-3 py-2 hover:bg-muted">Profile</Link>
            <SignOutButton className="flex items-center gap-1 rounded-lg px-3 py-2 hover:bg-muted" title="Sign out"><LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span></SignOutButton>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
