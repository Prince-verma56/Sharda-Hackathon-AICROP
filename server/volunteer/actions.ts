'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auditService } from '@/server/audit';
import { requireVolunteer } from '@/server/auth/dal';
import { db } from '@/server/db';

export interface VolunteerFormState {
  error?: string;
  ok?: string;
}

const LANGS = ['hi', 'en', 'mr', 'pa', 'bn', 'te', 'ta', 'gu', 'kn', 'ml', 'or'] as const;

const schema = z.object({
  serviceArea: z.string().trim().min(2, 'Enter the villages or block you will serve.').max(120),
  district: z.string().trim().min(2, 'Enter your district.').max(60),
  state: z.string().trim().min(2, 'Enter your state.').max(60),
  languages: z.array(z.enum(LANGS)).min(1, 'Choose at least one language.'),
  // optional
  village: z.string().trim().max(80).optional(),
  preferredLanguage: z.enum(['hi', 'en']).optional(),
  bio: z.string().trim().max(400).optional(),
  availability: z.enum(['weekdays', 'weekends', 'mornings', 'evenings', 'flexible']).optional(),
});

const opt = (value: FormDataEntryValue | null) => (typeof value === 'string' && value.trim() ? value : undefined);

/** Volunteer profile: service area, district, state and languages are required; the rest is optional. Phone comes from OTP. */
export async function saveVolunteerProfile(_prev: VolunteerFormState, form: FormData): Promise<VolunteerFormState> {
  const volunteer = await requireVolunteer();
  const parsed = schema.safeParse({
    serviceArea: form.get('serviceArea'),
    district: form.get('district'),
    state: form.get('state'),
    languages: form.getAll('languages'),
    village: opt(form.get('village')),
    preferredLanguage: opt(form.get('preferredLanguage')),
    bio: opt(form.get('bio')),
    availability: opt(form.get('availability')),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const name = String(form.get('name') ?? '').trim().slice(0, 80);
  const d = parsed.data;
  await db.$transaction([
    db.volunteerProfile.update({
      where: { userId: volunteer.userId },
      data: {
        serviceArea: d.serviceArea,
        district: d.district,
        state: d.state,
        languages: d.languages,
        village: d.village ?? null,
        preferredLanguage: d.preferredLanguage ?? null,
        bio: d.bio ?? null,
        availability: d.availability ?? null,
        profileCompletedAt: new Date(),
      },
    }),
    ...(name ? [db.user.update({ where: { id: volunteer.userId }, data: { name } })] : []),
  ]);
  await auditService.audit({ actorId: volunteer.userId, action: 'volunteer.profile_saved', resource: 'user', resourceId: volunteer.userId });
  redirect('/volunteer');
}

const activitySchema = z.object({
  kind: z.enum(['FIELD_VISIT', 'AWARENESS_SESSION', 'FARMER_ASSISTANCE', 'TRAINING']),
  occurredOn: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Choose a date.'),
  village: z.string().trim().max(80).optional(),
  farmersReached: z.coerce.number().int().min(0).max(5000),
  notes: z.string().trim().max(500).optional(),
  campaignId: z.string().max(40).optional(),
});

/**
 * Logs a volunteer activity. Only approved volunteers can log; counts only — no farmer names,
 * numbers or reports are collected here.
 */
export async function logActivity(_prev: VolunteerFormState, form: FormData): Promise<VolunteerFormState> {
  const volunteer = await requireVolunteer();
  if (volunteer.verificationStatus !== 'VERIFIED') return { error: 'Your volunteer account is waiting for admin approval.' };
  const parsed = activitySchema.safeParse({
    kind: form.get('kind'),
    occurredOn: form.get('occurredOn'),
    village: opt(form.get('village')),
    farmersReached: form.get('farmersReached') || 0,
    notes: opt(form.get('notes')),
    campaignId: opt(form.get('campaignId')),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const occurredOn = new Date(parsed.data.occurredOn);
  if (occurredOn.getTime() > Date.now() + 86_400_000) return { error: 'The date cannot be in the future.' };
  const campaign = parsed.data.campaignId ? await db.campaign.findFirst({ where: { id: parsed.data.campaignId, status: 'ACTIVE' }, select: { id: true } }) : null;
  const activity = await db.volunteerActivity.create({
    data: {
      volunteerId: volunteer.userId,
      kind: parsed.data.kind,
      occurredOn,
      village: parsed.data.village ?? null,
      farmersReached: parsed.data.farmersReached,
      notes: parsed.data.notes ?? null,
      campaignId: campaign?.id ?? null,
    },
  });
  await auditService.audit({ actorId: volunteer.userId, action: 'volunteer.activity_logged', resource: 'volunteer_activity', resourceId: activity.id });
  revalidatePath('/volunteer');
  revalidatePath('/volunteer/activities');
  return { ok: 'Activity saved. Thank you!' };
}
