import { Phone, ShieldCheck } from 'lucide-react';
import { Accent, PageIntro, eyebrowClass } from '@/components/app/page-intro';
import { cn } from '@/lib/utils';
import { requireVolunteer } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { db } from '@/server/db';
import { VolunteerForm } from './volunteer-form';

export const metadata = { title: 'Profile' };

export default async function VolunteerProfilePage() {
  const volunteer = await requireVolunteer();
  const profile = await db.volunteerProfile.findUnique({ where: { userId: volunteer.userId } });
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageIntro
        eyebrow="Volunteer profile"
        title={
          <>
            Your <Accent>field details</Accent>
          </>
        }
        description="Required before you start field work. Admins use it to verify you and assign villages."
      />
      <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-8">
          <VolunteerForm
            initial={{
              name: volunteer.name ?? '',
              serviceArea: profile?.serviceArea ?? '',
              district: profile?.district ?? '',
              state: profile?.state ?? '',
              languages: profile?.languages ?? [],
              village: profile?.village ?? '',
              preferredLanguage: profile?.preferredLanguage ?? '',
              bio: profile?.bio ?? '',
              availability: profile?.availability ?? '',
            }}
          />
        </div>
        <aside className="flex flex-col gap-4 rounded-[24px] bg-white p-5 ring-1 ring-border sm:p-6 lg:sticky lg:top-24 lg:col-span-4">
          <p className={cn(eyebrowClass(), 'text-[var(--crop-green-600)]')}>Account</p>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
              <Phone className="size-5" strokeWidth={1.7} />
            </span>
            <span>
              <span className="block font-semibold tabular-nums">{maskPhone(volunteer.phone)}</span>
              <span className="text-xs text-muted-foreground">Mobile verified by OTP</span>
            </span>
          </div>
          <p className="flex gap-2.5 rounded-2xl bg-[var(--crop-cream)] p-4 text-sm leading-relaxed text-muted-foreground ring-1 ring-border">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--crop-green-600)]" />
            Only admins see these details. Volunteer access is by invitation and is checked again on every request.
          </p>
        </aside>
      </div>
    </div>
  );
}
