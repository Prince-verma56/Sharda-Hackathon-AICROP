'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auditService } from '@/server/audit';
import { requireVolunteer } from '@/server/auth/dal';
import { db } from '@/server/db';

export interface VolunteerFormState {
  error?: string;
}

const schema = z.object({
  serviceArea: z.string().trim().min(2, 'Enter the villages or block you will serve.').max(120),
  district: z.string().trim().min(2, 'Enter your district.').max(60),
  state: z.string().trim().min(2, 'Enter your state.').max(60),
  languages: z.array(z.enum(['hi', 'en', 'mr', 'pa', 'bn', 'te', 'ta', 'gu', 'kn', 'ml', 'or'])).min(1, 'Choose at least one language.'),
});

/** The volunteer profile is required (service area, district, state, languages). Phone comes from Clerk. */
export async function saveVolunteerProfile(_prev: VolunteerFormState, form: FormData): Promise<VolunteerFormState> {
  const volunteer = await requireVolunteer();
  const parsed = schema.safeParse({
    serviceArea: form.get('serviceArea'),
    district: form.get('district'),
    state: form.get('state'),
    languages: form.getAll('languages'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const name = String(form.get('name') ?? '').trim().slice(0, 80);
  await db.$transaction([
    db.volunteerProfile.update({ where: { userId: volunteer.userId }, data: { ...parsed.data, profileCompletedAt: new Date() } }),
    ...(name ? [db.user.update({ where: { id: volunteer.userId }, data: { name } })] : []),
  ]);
  await auditService.audit({ actorId: volunteer.userId, action: 'volunteer.profile_saved', resource: 'user', resourceId: volunteer.userId });
  redirect('/volunteer');
}
