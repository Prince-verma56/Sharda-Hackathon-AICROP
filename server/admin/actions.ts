'use server';

/**
 * Admin portal mutations. EVERY action re-checks the staff session and permission
 * server-side (navigation hiding is cosmetic) and writes an audit event.
 */
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { splitLabel } from '@/lib/crops';
import { auditService } from '@/server/audit';
import { requireStaff } from '@/server/auth/dal';
import { revokeAllSessions } from '@/server/auth/session';
import { normalizePhoneE164 } from '@/server/auth/phone';
import { storeImage } from '@/server/cropai/image-store';
import { invalidateGuidance } from '@/server/cropai/knowledge';
import { fetchSourceExcerpt, searchSources } from '@/server/cropai/research';
import { saveSettings, SETTINGS_SCHEMA } from '@/server/cropai/settings';
import { MitraDefaultsSchema, saveMitraDefaults } from '@/ai/settings/mitra-settings';
import { getTaxonomy } from '@/server/cropai/taxonomy';
import { db } from '@/server/db';
import { notificationService } from '@/server/notifications';
import { invitationPath, newInviteToken } from '@/server/volunteer/invitations';

export interface ActionState {
  error?: string;
  ok?: string;
  data?: unknown;
}

const lines = (value: FormDataEntryValue | null) =>
  String(value ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

// ---- Expert review ----------------------------------------------------------------------

export async function submitReview(_prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff('reviews:write');
  const parsed = z
    .object({
      diagnosisId: z.string().min(1),
      verdict: z.enum(['CONFIRMED', 'CHALLENGED', 'NEEDS_INFO']),
      correctedLabel: z.string().max(120).optional(),
      note: z.string().trim().min(3, 'Add a short review note.').max(2000),
    })
    .safeParse({
      diagnosisId: form.get('diagnosisId'),
      verdict: form.get('verdict'),
      correctedLabel: (form.get('correctedLabel') as string) || undefined,
      note: form.get('note'),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid review.' };
  const { diagnosisId, verdict, correctedLabel, note } = parsed.data;
  if (verdict === 'CHALLENGED' && correctedLabel) {
    const taxonomy = await getTaxonomy();
    const valid = taxonomy.crops.some((c) => c.classes.some((k) => k.label === correctedLabel));
    if (!valid) return { error: 'Corrected condition must be a class the model supports.' };
  }
  const diagnosis = await db.diagnosis.findUnique({ where: { id: diagnosisId }, select: { farmerId: true } });
  if (!diagnosis) return { error: 'Diagnosis not found.' };

  await db.$transaction([
    db.expertReview.create({ data: { diagnosisId, reviewerId: staff.userId, verdict, correctedLabel: verdict === 'CHALLENGED' ? correctedLabel ?? null : null, note } }),
    db.diagnosis.update({ where: { id: diagnosisId }, data: { reviewStatus: verdict } }),
  ]);
  await auditService.audit({ actorId: staff.userId, action: 'diagnosis.review', resource: 'diagnosis', resourceId: diagnosisId, metadata: { verdict, correctedLabel: correctedLabel ?? null } });
  await notificationService
    .notify({
      userId: diagnosis.farmerId,
      type: 'review.completed',
      title: verdict === 'NEEDS_INFO' ? 'विशेषज्ञ को और जानकारी चाहिए' : 'विशेषज्ञ ने रिपोर्ट देखी',
      message: verdict === 'CONFIRMED' ? 'AI नतीजे की पुष्टि हुई।' : verdict === 'CHALLENGED' ? 'विशेषज्ञ की राय अलग है — रिपोर्ट देखें।' : 'कृपया एक और साफ़ फोटो लें।',
      channel: 'in-app',
      metadata: { diagnosisId },
    })
    .catch(() => undefined);
  revalidatePath(`/admin/diagnoses/${diagnosisId}`);
  revalidatePath('/admin/expert-review');
  return { ok: 'Review saved. The farmer has been notified.' };
}

// ---- Knowledge base ---------------------------------------------------------------------

export async function saveKnowledge(_prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff('knowledge:edit');
  const conditionLabel = String(form.get('conditionLabel') ?? '');
  const taxonomy = await getTaxonomy();
  if (!taxonomy.crops.some((c) => c.classes.some((k) => k.label === conditionLabel))) {
    return { error: 'Choose a condition the model actually supports.' };
  }
  const title = String(form.get('title') ?? '').trim();
  const summary = String(form.get('summary') ?? '').trim();
  const sourceUrl = String(form.get('sourceUrl') ?? '').trim();
  if (title.length < 3 || summary.length < 10) return { error: 'Title and summary are required.' };
  if (sourceUrl && !/^https?:\/\//.test(sourceUrl)) return { error: 'Source URL must start with http(s)://' };

  const data = {
    crop: splitLabel(conditionLabel).crop,
    conditionLabel,
    title: title.slice(0, 160),
    summary: summary.slice(0, 2000),
    symptoms: lines(form.get('symptoms')),
    causes: lines(form.get('causes')),
    inspectionSteps: lines(form.get('inspectionSteps')),
    prevention: lines(form.get('prevention')),
    approvedTreatment: lines(form.get('approvedTreatment')),
    furtherTesting: lines(form.get('furtherTesting')),
    regions: lines(form.get('regions')),
    sourceUrl: sourceUrl || null,
    sourceOrganisation: String(form.get('sourceOrganisation') ?? '').trim().slice(0, 160) || null,
    referenceImageCredit: String(form.get('referenceImageCredit') ?? '').trim().slice(0, 200) || null,
  };

  const image = form.get('referenceImage');
  let referenceImageKey: string | undefined;
  if (image instanceof File && image.size > 0) {
    if (image.size > 6 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) return { error: 'Reference image must be JPEG/PNG/WebP under 6 MB.' };
    if (!data.referenceImageCredit) return { error: 'Add the licence/credit for the reference image.' };
    referenceImageKey = (await storeImage(Buffer.from(await image.arrayBuffer()), 'knowledge')).key;
  }

  const id = String(form.get('id') ?? '');
  let entryId = id;
  if (id) {
    const existing = await db.knowledgeEntry.findUnique({ where: { id } });
    if (!existing) return { error: 'Entry not found.' };
    // Any edit sends an approved entry back to review (farmers keep seeing nothing new until re-approved).
    await db.knowledgeEntry.update({
      where: { id },
      data: { ...data, ...(referenceImageKey ? { referenceImageKey } : {}), status: 'IN_REVIEW', version: existing.version + 1, reviewedById: null, reviewedAt: null },
    });
    await invalidateGuidance(existing.conditionLabel);
  } else {
    const created = await db.knowledgeEntry.create({ data: { ...data, referenceImageKey: referenceImageKey ?? null, status: 'IN_REVIEW', createdById: staff.userId } });
    entryId = created.id;
  }
  await auditService.audit({ actorId: staff.userId, action: id ? 'knowledge.update' : 'knowledge.create', resource: 'knowledge_entry', resourceId: entryId, metadata: { conditionLabel } });
  revalidatePath('/admin/knowledge-base');
  if (!id) redirect(`/admin/knowledge-base/${entryId}`);
  revalidatePath(`/admin/knowledge-base/${entryId}`);
  return { ok: 'Saved. Status: in review (needs approval before farmers see it).' };
}

export async function reviewKnowledge(_prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff('knowledge:approve');
  const id = String(form.get('id') ?? '');
  const decision = String(form.get('decision') ?? '');
  const note = String(form.get('reviewNote') ?? '').trim().slice(0, 1000) || null;
  if (decision !== 'APPROVED' && decision !== 'REJECTED') return { error: 'Choose approve or reject.' };
  const entry = await db.knowledgeEntry.findUnique({ where: { id } });
  if (!entry) return { error: 'Entry not found.' };
  if (decision === 'APPROVED' && entry.createdById === staff.userId && staff.role !== 'SUPER_ADMIN') {
    return { error: 'A different expert must approve your own entry.' };
  }
  if (decision === 'APPROVED' && !entry.sourceUrl) return { error: 'Add a source URL before approving.' };
  const now = new Date();
  await db.$transaction(async (tx) => {
    if (decision === 'APPROVED') {
      // Only one approved entry per condition at a time.
      await tx.knowledgeEntry.updateMany({ where: { conditionLabel: entry.conditionLabel, status: 'APPROVED', id: { not: id } }, data: { status: 'DRAFT' } });
    }
    await tx.knowledgeEntry.update({ where: { id }, data: { status: decision, reviewNote: note, reviewedById: staff.userId, reviewedAt: now, lastReviewedAt: decision === 'APPROVED' ? now : entry.lastReviewedAt } });
  });
  await invalidateGuidance(entry.conditionLabel);
  await auditService.audit({ actorId: staff.userId, action: `knowledge.${decision.toLowerCase()}`, resource: 'knowledge_entry', resourceId: id, metadata: { conditionLabel: entry.conditionLabel } });
  revalidatePath(`/admin/knowledge-base/${id}`);
  revalidatePath('/admin/knowledge-base');
  return { ok: decision === 'APPROVED' ? 'Approved — now used in farmer reports.' : 'Rejected.' };
}

export async function researchSources(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireStaff('research:use');
  const label = String(form.get('conditionLabel') ?? '');
  const fetchUrl = String(form.get('fetchUrl') ?? '');
  try {
    if (fetchUrl) return { data: { excerpt: await fetchSourceExcerpt(fetchUrl) } };
    const { crop, condition } = splitLabel(label);
    if (!crop || !condition) return { error: 'Choose a condition first.' };
    return { data: { results: await searchSources(crop.replace(/_/g, ' '), condition) } };
  } catch (error) {
    const code = (error as Error).message;
    return { error: code === 'RESEARCH_NOT_CONFIGURED' ? 'TinyFish is not configured (TINYFISH_API_KEY).' : `Source search failed (${code}).` };
  }
}

// ---- Settings, staff and farmers ---------------------------------------------------------

export async function updateSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff('settings:manage');
  const parsed = SETTINGS_SCHEMA.safeParse({
    image_retention_days: Number(form.get('image_retention_days')),
    auto_queue_uncertain_for_review: form.get('auto_queue_uncertain_for_review') === 'on',
    support_contact: String(form.get('support_contact') ?? '').trim(),
    farmer_notice: String(form.get('farmer_notice') ?? '').trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid settings.' };
  await saveSettings(parsed.data, staff.userId);
  await auditService.audit({ actorId: staff.userId, action: 'settings.update', resource: 'platform_settings', resourceId: 'global', metadata: parsed.data });
  revalidatePath('/admin/settings');
  return { ok: 'Settings saved.' };
}

/** Mitra defaults for every farmer who has not chosen their own (+ optional guidance for the prompt). */
export async function updateMitraDefaults(_prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff('settings:manage');
  const parsed = MitraDefaultsSchema.safeParse({
    language: form.get('language'),
    tone: form.get('tone'),
    voice: form.get('voice'),
    pace: form.get('pace'),
    length: form.get('length'),
    extraInstructions: String(form.get('extraInstructions') ?? ''),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid Mitra settings.' };
  await saveMitraDefaults(parsed.data, staff.userId);
  const { extraInstructions, ...choices } = parsed.data;
  await auditService.audit({ actorId: staff.userId, action: 'settings.mitra_defaults', resource: 'platform_settings', resourceId: 'mitra_defaults', metadata: { ...choices, extraInstructionsLength: extraInstructions.length } });
  revalidatePath('/admin/settings');
  return { ok: 'Mitra defaults saved. They apply to every farmer who has not chosen their own, from their next message or call.' };
}

export async function createRoleInvitation(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = form.get('role') === 'ADMIN' ? 'ADMIN' : 'VOLUNTEER';
  const staff = await requireStaff(role === 'ADMIN' ? 'admins:manage' : 'volunteers:manage');
  const country = String(form.get('countryCode') ?? '+91').trim();
  const raw = String(form.get('phone') ?? '').trim();
  const phone = normalizePhoneE164(raw.startsWith('+') || country === '+91' ? raw : `${country}${raw.replace(/\D/g, '')}`);
  if (!phone) return { error: 'Enter a valid mobile number (10-digit Indian number, or choose the country code).' };
  const adminLevel = role === 'ADMIN' ? (['ADMIN', 'AGRONOMIST', 'REVIEWER', 'ANALYST'].includes(String(form.get('adminLevel'))) ? (String(form.get('adminLevel')) as 'ADMIN') : 'ADMIN') : null;
  const text = (name: string, max: number) => String(form.get(name) ?? '').trim().slice(0, max) || null;
  const days = [3, 7, 14, 30].includes(Number(form.get('expiresInDays'))) ? Number(form.get('expiresInDays')) : 14;
  const existing = await db.user.findUnique({ where: { phone }, include: { roles: true } });
  if (existing?.roles.some((r) => r.role === role)) return { error: `This number already has the ${role.toLowerCase()} role.` };

  // One active invitation per number and role: a new invitation replaces (revokes) the previous one.
  const replaced = await db.roleInvitation.updateMany({ where: { phone, role, status: 'PENDING' }, data: { status: 'REVOKED' } });
  const { token, tokenHash } = newInviteToken();
  const invite = await db.roleInvitation.create({
    data: {
      phone,
      role,
      adminLevel,
      serviceArea: text('serviceArea', 120),
      inviteeName: text('inviteeName', 80),
      district: text('district', 60),
      village: text('village', 80),
      tokenHash: role === 'VOLUNTEER' ? tokenHash : null,
      invitedById: staff.userId,
      expiresAt: new Date(Date.now() + days * 86_400_000),
    },
  });
  await auditService.audit({ actorId: staff.userId, action: 'role.invite', resource: 'role_invitation', resourceId: invite.id, metadata: { role, adminLevel, days, replaced: replaced.count } });
  revalidatePath('/admin/settings');
  revalidatePath('/admin/volunteers');
  if (role === 'ADMIN') {
    return { ok: `Invitation created (valid ${days} days). The person signs in at /login with ${phone} — the admin role is added after phone verification.` };
  }
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https');
  return {
    ok: `Invitation created for ${phone} (valid ${days} days)${replaced.count ? ' — the earlier invitation for this number was replaced' : ''}. Share the link below; it works only after OTP verification of this number.`,
    data: { link: `${proto}://${host}${invitationPath(token)}`, phone, days },
  };
}

export async function revokeRoleInvitation(form: FormData) {
  const staff = await requireStaff('volunteers:manage');
  const id = String(form.get('id') ?? '');
  const invite = await db.roleInvitation.findUnique({ where: { id } });
  if (!invite || invite.status !== 'PENDING') return;
  if (invite.role === 'ADMIN') await requireStaff('admins:manage');
  await db.roleInvitation.update({ where: { id }, data: { status: 'REVOKED' } });
  await auditService.audit({ actorId: staff.userId, action: 'role.invite_revoked', resource: 'role_invitation', resourceId: id });
  revalidatePath('/admin/settings');
  revalidatePath('/admin/volunteers');
}

/** Suspends or reactivates any account; suspension also revokes every active session immediately. */
export async function setUserStatus(form: FormData) {
  const staff = await requireStaff('farmers:manage');
  const id = String(form.get('id') ?? '');
  if (id === staff.userId) return;
  const target = await db.user.findUnique({ where: { id }, include: { roles: true } });
  if (!target) return;
  if (target.roles.some((r) => r.role === 'ADMIN' || r.role === 'SUPER_ADMIN')) await requireStaff('admins:manage');
  const status = form.get('status') === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
  await db.user.update({ where: { id }, data: { status } });
  if (status === 'SUSPENDED') await revokeAllSessions(id);
  await auditService.audit({ actorId: staff.userId, action: `user.${status.toLowerCase()}`, resource: 'user', resourceId: id });
  revalidatePath(`/admin/farmers/${id}`);
  revalidatePath('/admin/settings');
}

/** Removes a VOLUNTEER or ADMIN role (never the user's own, never FARMER). */
export async function revokeUserRole(form: FormData) {
  const role = form.get('role') === 'ADMIN' ? 'ADMIN' : 'VOLUNTEER';
  const staff = await requireStaff(role === 'ADMIN' ? 'admins:manage' : 'volunteers:manage');
  const userId = String(form.get('userId') ?? '');
  if (userId === staff.userId) return;
  await db.userRole.deleteMany({ where: { userId, role } });
  await revokeAllSessions(userId);
  await auditService.audit({ actorId: staff.userId, action: 'role.revoked', resource: 'user', resourceId: userId, metadata: { role } });
  revalidatePath('/admin/settings');
  revalidatePath('/admin/volunteers');
}
