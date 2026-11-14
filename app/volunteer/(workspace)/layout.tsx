import { Manrope } from 'next/font/google';
import { AccountMenu } from '@/components/auth/account-menu';
import { WorkspaceMenu } from '@/components/workspace/workspace-menu';
import { brand } from '@/config/brand';
import { requireVolunteer } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { VolunteerHeader } from './volunteer-nav';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata = { title: { default: 'Volunteer', template: `%s · ${brand.name} Volunteer` }, robots: { index: false } };

export default async function VolunteerLayout({ children }: { children: React.ReactNode }) {
  const volunteer = await requireVolunteer();
  return (
    <div className={`theme-crop ${manrope.variable} flex min-h-dvh flex-1 flex-col bg-[var(--crop-cream)] antialiased`}>
      <VolunteerHeader>
        <WorkspaceMenu current="volunteer" className="h-9 px-3 text-xs" />
        <AccountMenu label={volunteer.name ? `${volunteer.name} · ${maskPhone(volunteer.phone)}` : maskPhone(volunteer.phone)} links={[{ href: '/volunteer/profile', label: 'Profile', icon: 'profile' }]} />
      </VolunteerHeader>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col px-4 pt-6 pb-10 sm:px-6 lg:px-8 lg:pt-10">{children}</main>
    </div>
  );
}
