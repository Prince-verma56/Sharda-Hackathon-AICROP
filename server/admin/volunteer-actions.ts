'use server';

/**
 * Admin volunteer programme actions: approve/suspend volunteers, training status, educational
 * video review and campaigns. Every action re-checks the staff permission on the server and is
 * written to the audit log.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auditService } from '@/server/audit';
import { requireStaff } from '@/server/auth/dal';
import { db } from '@/server/db';
import type { ActionState } from './actions';

const refresh = (userId?: string) => {
  revalidatePath('/admin/volunteers');
  if (userId) revalidatePath(`/admin/volunteers/${userId}`);
};

/** VERIFIED = approved; SUSPENDED blocks the volunteer workspace only (a farmer account keeps working). */
export async function setVolunteerStatus(form: FormData) {
  const staff = await requireStaff('volunteers:manage');
  const userId = String(form.get('userId') ?? '');
  const status = z.enum(['PENDING', 'VERIFIED', 'SUSPENDED']).safeParse(form.get('status'));
  if (!status.success) return;
  const updated = await db.volunteerProfile.updateMany({ where: { userId }, data: { verificationStatus: status.data } });
  if (!updated.count) return;
  await auditService.audit({ actorId: staff.userId, action: `volunteer.${status.data.toLowerCase()}`, resource: 'user', resourceId: userId });
  refresh(userId);
}

export async function setTrainingStatus(form: FormData) {
  const staff = await requireStaff('volunteers:manage');
  const userId = String(form.get('userId') ?? '');
  const status = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).safeParse(form.get('status'));
  if (!status.success) return;
  await db.volunteerProfile.updateMany({ where: { userId }, data: { trainingStatus: status.data } });
  await auditService.audit({ actorId: staff.userId, action: 'volunteer.training', resource: 'user', resourceId: userId, metadata: { status: status.data } });
  refresh(userId);
}

/** Educational videos are visible to farmers only after approval. */
export async function reviewVideo(form: FormData) {
  const staff = await requireStaff('volunteers:manage');
  const id = String(form.get('id') ?? '');
  const decision = z.enum(['APPROVED', 'REJECTED']).safeParse(form.get('decision'));
  if (!decision.success) return;
  const note = String(form.get('note') ?? '').trim().slice(0, 300) || null;
  const video = await db.volunteerVideo.update({ where: { id }, data: { status: decision.data, reviewNote: note, reviewedById: staff.userId, reviewedAt: new Date() } }).catch(() => null);
  if (!video) return;
  await auditService.audit({ actorId: staff.userId, action: `volunteer_video.${decision.data.toLowerCase()}`, resource: 'volunteer_video', resourceId: id });
  refresh(video.volunteerId);
}

const campaignSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(1000),
  region: z.string().trim().max(120).optional(),
  startsOn: z.string().optional(),
  endsOn: z.string().optional(),
});

export async function createCampaign(_prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff('volunteers:manage');
  const parsed = campaignSchema.safeParse({
    title: form.get('title'),
    description: form.get('description'),
    region: String(form.get('region') ?? '') || undefined,
    startsOn: String(form.get('startsOn') ?? '') || undefined,
    endsOn: String(form.get('endsOn') ?? '') || undefined,
  });
  if (!parsed.success) return { error: 'Add a title (3+ characters) and a short description (10+ characters).' };
  const date = (v?: string) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null);
  const campaign = await db.campaign.create({
    data: { title: parsed.data.title, description: parsed.data.description, region: parsed.data.region ?? null, startsOn: date(parsed.data.startsOn), endsOn: date(parsed.data.endsOn), createdById: staff.userId },
  });
  await auditService.audit({ actorId: staff.userId, action: 'campaign.create', resource: 'campaign', resourceId: campaign.id });
  refresh();
  revalidatePath('/volunteer');
  return { ok: `Campaign “${campaign.title}” is live for volunteers.` };
}

export async function setCampaignStatus(form: FormData) {
  const staff = await requireStaff('volunteers:manage');
  const id = String(form.get('id') ?? '');
  const status = z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).safeParse(form.get('status'));
  if (!status.success) return;
  await db.campaign.update({ where: { id }, data: { status: status.data } }).catch(() => null);
  await auditService.audit({ actorId: staff.userId, action: `campaign.${status.data.toLowerCase()}`, resource: 'campaign', resourceId: id });
  refresh();
  revalidatePath('/volunteer');
}
