import { requireVolunteer } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { db } from '@/server/db';
import { VolunteerForm } from './volunteer-form';

export const metadata = { title: 'Profile' };

export default async function VolunteerProfilePage() {
  const volunteer = await requireVolunteer();
  const profile = await db.volunteerProfile.findUnique({ where: { userId: volunteer.userId } });
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Volunteer profile</h1>
        <p className="text-sm text-muted-foreground">Signed in as {maskPhone(volunteer.phone)} (verified by OTP). Required before you start field work.</p>
      </header>
      <VolunteerForm initial={{ name: volunteer.name ?? '', serviceArea: profile?.serviceArea ?? '', district: profile?.district ?? '', state: profile?.state ?? '', languages: profile?.languages ?? [] }} />
    </div>
  );
}
