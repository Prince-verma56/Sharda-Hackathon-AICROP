/**
 * PATCH /api/v1/farmer/profile — optional profile + farm location (all fields optional).
 * POST  /api/v1/farmer/profile { complete: true } marks onboarding done (or skipped).
 */
import { z } from 'zod';
import { getCurrentFarmer } from '@/server/auth/dal';
import { db } from '@/server/db';
import { fail, ok, readJson } from '@/server/http/respond';

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
