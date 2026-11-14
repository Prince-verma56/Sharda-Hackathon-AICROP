/**
 * GET   /api/v1/farmer/profile — the farmer's profile, farm location and consent choices.
 * PATCH /api/v1/farmer/profile — optional profile + farm location (all fields optional).
 * POST  /api/v1/farmer/profile { complete: true } marks onboarding done (or skipped).
 */
import { z } from 'zod';
import { getMitraConsent } from '@/ai/conversation/mitra';
import { cropName } from '@/lib/crops';
import { getCurrentFarmer } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { db } from '@/server/db';
import { fail, ok, readJson } from '@/server/http/respond';

export async function GET() {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const [profile, farm, consent] = await Promise.all([
    db.farmerProfile.findUnique({ where: { userId: farmer.userId } }),
    db.farm.findFirst({ where: { ownerId: farmer.userId, isPrimary: true } }),
    getMitraConsent(farmer.userId),
  ]);
  const lang = profile?.language === 'en' ? 'en' : 'hi';
  return ok({
    userId: farmer.userId,
    phoneMasked: maskPhone(farmer.phone),
    preferredName: profile?.preferredName ?? null,
    language: lang,
    state: profile?.state ?? null,
    district: profile?.district ?? null,
    village: profile?.village ?? null,
    mainCrops: (profile?.mainCrops ?? []).map((id) => ({ id, name: cropName(id, lang) })),
    farmSizeAcres: profile?.farmSizeAcres != null ? Number(profile.farmSizeAcres) : null,
    voiceEnabled: profile?.voiceEnabled ?? true,
    onboarded: Boolean(profile?.onboardedAt),
    location: farm?.latitude != null && farm.longitude != null ? { latitude: farm.latitude, longitude: farm.longitude, label: farm.locationLabel } : null,
    consent: {
      photos: Boolean(profile?.photoConsentAt),
      photosAt: profile?.photoConsentAt?.toISOString() ?? null,
      chatHistory: consent.chatHistory,
      voiceTranscripts: consent.voiceTranscripts,
      policyVersion: consent.version,
    },
  });
}

const schema = z.object({
  preferredName: z.string().trim().max(60).nullable().optional(),
  language: z.enum(['hi', 'en']).optional(),
  state: z.string().trim().max(60).nullable().optional(),
  district: z.string().trim().max(60).nullable().optional(),
  village: z.string().trim().max(80).nullable().optional(),
  mainCrops: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,40}$/)).max(8).optional(),
  farmSizeAcres: z.number().min(0).max(100000).nullable().optional(),
  voiceEnabled: z.boolean().optional(),
  photoConsent: z.boolean().optional(),
  location: z
    .object({ latitude: z.number().min(6).max(38), longitude: z.number().min(68).max(98), label: z.string().max(160).nullable() })
    .nullable()
    .optional(),
  complete: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const body = await readJson(req, schema);
  if ('error' in body) return body.error;
  const { location, complete, photoConsent, preferredName, ...rest } = body.data;

  await db.$transaction(async (tx) => {
    await tx.farmerProfile.upsert({
      where: { userId: farmer.userId },
      create: { userId: farmer.userId, ...rest, preferredName: preferredName || null },
      update: {
        ...rest,
        ...(preferredName !== undefined ? { preferredName: preferredName || null } : {}),
        ...(photoConsent === true ? { photoConsentAt: new Date() } : photoConsent === false ? { photoConsentAt: null } : {}),
        ...(complete ? { onboardedAt: new Date() } : {}),
      },
    });
    if (preferredName !== undefined) await tx.user.update({ where: { id: farmer.userId }, data: { name: preferredName || null } });
    if (location !== undefined) {
      const farm = await tx.farm.findFirst({ where: { ownerId: farmer.userId, isPrimary: true } });
      const data = location
        ? { latitude: location.latitude, longitude: location.longitude, locationLabel: location.label }
        : { latitude: null, longitude: null, locationLabel: null };
      if (farm) await tx.farm.update({ where: { id: farm.id }, data });
      else await tx.farm.create({ data: { ownerId: farmer.userId, isPrimary: true, ...data } });
    }
    if (rest.farmSizeAcres !== undefined) {
      await tx.farm.updateMany({ where: { ownerId: farmer.userId, isPrimary: true }, data: { areaAcres: rest.farmSizeAcres } });
    }
  });
  return ok({ saved: true });
}

export const POST = PATCH;
