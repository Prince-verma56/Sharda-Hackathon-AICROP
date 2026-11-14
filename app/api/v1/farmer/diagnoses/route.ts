/**
 * POST /api/v1/farmer/diagnoses  multipart: image, crop, consent?, context?
 * Authenticated farmer upload -> real model -> persisted report. Returns { id }.
 * `crop=auto` (farmer does not know the crop): the model predicts crop and condition together
 * (global scores, `cropSource: "model"`) — the report shows the crop was detected, not chosen.
 *
 * GET /api/v1/farmer/diagnoses?limit=20&cursor=<id>  the farmer's own reports, newest first.
 */
import { MAX_IMAGE_BYTES } from '@/ai/diagnosis';
import { cropName } from '@/lib/crops';
import { getCurrentFarmer } from '@/server/auth/dal';
import { getCropImages } from '@/server/cropai/crop-images';
import { createDiagnosis, DiagnosisError } from '@/server/cropai/diagnosis-service';
import { isSupportedCrop } from '@/server/cropai/taxonomy';
import { db } from '@/server/db';
import { fail, limit, ok, rejectCrossSiteUpload } from '@/server/http/respond';
import { FieldContextSchema, sanitizeFieldContext, type FieldContext } from '@/lib/cropai/field-context';
import { saveFieldContext } from '@/server/cropai/field-context';

export const maxDuration = 90;

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MESSAGES: Record<string, string> = {
  INFERENCE_OFFLINE: 'The crop doctor is offline right now. Please try again later.',
  MODEL_UNAVAILABLE: 'The crop doctor is not ready. Please try again later.',
  MODEL_LOADING: 'The crop doctor is starting. Try again in a few seconds.',
  INFERENCE_BUSY: 'Many farmers are checking crops right now. Try again in a few seconds.',
  INFERENCE_TIMEOUT: 'The check took too long. Please try again.',
  IMAGE_INVALID: 'This file is not a readable photo.',
  IMAGE_FORMAT_UNSUPPORTED: 'Please use a JPG, PNG or WebP photo.',
  IMAGE_SIZE_INVALID: 'The photo is empty or larger than 8 MB.',
  IMAGE_PIXEL_LIMIT: 'The photo is too large. Please use a smaller photo.',
  IMAGE_DIMENSIONS_OR_ANIMATION_INVALID: 'The photo is too small. Take a closer photo of the leaf.',
  CROP_UNSUPPORTED: 'This crop is not supported yet.',
};

export async function POST(req: Request) {
  const blocked = rejectCrossSiteUpload(req);
  if (blocked) return blocked;
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const limited = await limit(req, `farmer-diagnose:${farmer.userId}`, 15);
  if (limited) return limited;

  if (Number(req.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 64 * 1024) {
    return fail('IMAGE_SIZE_INVALID', 413, MESSAGES.IMAGE_SIZE_INVALID);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('INVALID_FORM', 400, 'Upload the photo again.');
  }
  const image = form.get('image');
  if (!(image instanceof Blob) || image.size === 0) return fail('IMAGE_REQUIRED', 422, 'Please add a photo.');
  if (image.size > MAX_IMAGE_BYTES) return fail('IMAGE_SIZE_INVALID', 413, MESSAGES.IMAGE_SIZE_INVALID);
  if (image.type && !ACCEPTED.includes(image.type)) return fail('IMAGE_FORMAT_UNSUPPORTED', 415, MESSAGES.IMAGE_FORMAT_UNSUPPORTED);

  const rawCrop = form.get('crop');
  const autoCrop = rawCrop === 'auto';
  const crop = !autoCrop && typeof rawCrop === 'string' && /^[a-z][a-z0-9_]{1,40}$/.test(rawCrop) ? rawCrop : null;
  if (!crop && !autoCrop) return fail('CROP_REQUIRED', 422, 'Please choose your crop first.');
  if (crop) {
    try {
      if (!(await isSupportedCrop(crop))) return fail('CROP_UNSUPPORTED', 422, MESSAGES.CROP_UNSUPPORTED);
    } catch {
      return fail('INFERENCE_OFFLINE', 503, MESSAGES.INFERENCE_OFFLINE);
    }
  }

  const profile = await db.farmerProfile.findUnique({ where: { userId: farmer.userId }, select: { photoConsentAt: true } });
  if (!profile?.photoConsentAt) {
    if (form.get('consent') !== 'true') return fail('CONSENT_REQUIRED', 428, 'Please allow us to keep your photo for your report.');
    await db.farmerProfile.update({ where: { userId: farmer.userId }, data: { photoConsentAt: new Date() } });
  }

  // Optional field details (never required). Invalid details are ignored, never block a check.
  let fieldContext: FieldContext | null = null;
  let saveFarmLocation = false;
  const rawContext = form.get('context');
  if (typeof rawContext === 'string' && rawContext.length < 4000) {
    try {
      const json = JSON.parse(rawContext) as Record<string, unknown>;
      saveFarmLocation = json.saveFarmLocation === true;
      const parsed = FieldContextSchema.safeParse(json);
      if (parsed.success) fieldContext = sanitizeFieldContext(parsed.data);
    } catch {}
  }
  // The farmer allowed device location and has no farm location yet: save it (~1 km) so this check
  // and future ones get local weather.
  if (fieldContext?.location && saveFarmLocation) {
    const farm = await db.farm.findFirst({ where: { ownerId: farmer.userId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] });
    const { latitude, longitude } = fieldContext.location;
    const label = farmer.language === 'hi' ? 'फोन की लोकेशन' : 'Phone location';
    if (!farm) await db.farm.create({ data: { ownerId: farmer.userId, latitude, longitude, locationLabel: label, isPrimary: true } });
    else if (farm.latitude == null || farm.longitude == null) await db.farm.update({ where: { id: farm.id }, data: { latitude, longitude, locationLabel: farm.locationLabel ?? label } });
  }

  try {
    const diagnosis = await createDiagnosis({
      farmerId: farmer.userId,
      image,
      filename: image instanceof File ? image.name : 'photo.jpg',
      crop,
      language: farmer.language === 'en' ? 'en' : 'hi',
      farmerName: farmer.preferredName,
    });
    if (fieldContext) await saveFieldContext(diagnosis.id, fieldContext).catch((error) => console.warn('[farmer-diagnosis] field details not saved', (error as Error).message));
    return ok({ id: diagnosis.id }, 201);
  } catch (error) {
    if (error instanceof DiagnosisError) {
      return fail(error.code, error.status, MESSAGES[error.code] ?? 'The check failed. Please try again.');
    }
    console.error('[farmer-diagnosis] failed', (error as Error).message);
    return fail('DIAGNOSIS_FAILED', 500, 'The check failed. Please try again.');
  }
}

export async function GET(req: Request) {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const params = new URL(req.url).searchParams;
  const limitParam = Number(params.get('limit') ?? 20);
  const take = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;
  const cursor = params.get('cursor');
  if (cursor !== null && !/^[a-z0-9]{8,40}$/i.test(cursor)) return fail('CURSOR_INVALID', 422, 'Invalid page cursor.');
  const lang = params.get('lang') === 'en' || params.get('lang') === 'hi' ? (params.get('lang') as 'hi' | 'en') : farmer.language === 'en' ? 'en' : 'hi';

  // A cursor is only honoured if it belongs to this farmer (no probing other farmers' ids).
  if (cursor && !(await db.diagnosis.findFirst({ where: { id: cursor, farmerId: farmer.userId }, select: { id: true } }))) {
    return fail('CURSOR_INVALID', 422, 'Invalid page cursor.');
  }
  const [rows, total, cropImages] = await Promise.all([
    db.diagnosis.findMany({
      where: { farmerId: farmer.userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, createdAt: true, status: true, predictedCrop: true, selectedCrop: true, predictedCondition: true, isHealthy: true, confidence: true, reviewStatus: true, imageKey: true, advisories: true },
    }),
    db.diagnosis.count({ where: { farmerId: farmer.userId } }),
    getCropImages(),
  ]);
  const page = rows.slice(0, take);
  return ok({
    items: page.map((d) => ({
      id: d.id,
      createdAt: d.createdAt.toISOString(),
      status: d.status,
      crop: { id: d.predictedCrop, name: cropName(d.predictedCrop, lang), imageUrl: cropImages[d.predictedCrop] ?? null },
      condition: d.predictedCondition,
      isHealthy: d.isHealthy,
      score: d.confidence,
      uncertain: Array.isArray(d.advisories) && d.advisories.length > 0,
      reviewStatus: d.reviewStatus,
      thumbnailUrl: d.imageKey ? `/api/v1/images/diagnoses/${d.id}` : null,
    })),
    total,
    nextCursor: rows.length > take ? page.at(-1)?.id ?? null : null,
  });
}
