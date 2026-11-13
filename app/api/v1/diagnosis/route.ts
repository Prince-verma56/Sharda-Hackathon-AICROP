/**
 * POST /api/v1/diagnosis
 *
 * multipart/form-data: image (JPEG/PNG/WebP <= 8 MB), crop? (id from /api/v1/crops), topK? (1-10)
 * Forwards the photo to the private AgriSmart inference service and returns the real
 * model output. No mock path exists here.
 */
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, diagnose } from '@/ai/diagnosis';
import { enforceAccess, enforceRateLimit, fail, failFromError, ok } from '@/ai/diagnosis/http';

export const maxDuration = 90;

const CROP_ID = /^[a-z][a-z0-9_]{1,40}$/;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  const denied = (await enforceAccess(requestId)) ?? (await enforceRateLimit(req, 'predict', 20, requestId));
  if (denied) return denied;

  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_IMAGE_BYTES + 64 * 1024) {
    return fail('IMAGE_SIZE_INVALID', 413, requestId);
  }
  if (!req.headers.get('content-type')?.startsWith('multipart/form-data')) {
    return fail('INVALID_FORM', 400, requestId);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('INVALID_FORM', 400, requestId);
  }

  const image = form.get('image');
  if (!(image instanceof Blob) || image.size === 0) {
    return fail('IMAGE_REQUIRED', 422, requestId);
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return fail('IMAGE_SIZE_INVALID', 413, requestId);
  }
  // The browser-declared type is advisory; the inference service decodes the actual bytes.
  if (image.type && !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(image.type)) {
    return fail('IMAGE_FORMAT_UNSUPPORTED', 415, requestId);
  }

  const rawCrop = form.get('crop');
  const crop = typeof rawCrop === 'string' && rawCrop.trim() ? rawCrop.trim().toLowerCase() : null;
  if (crop !== null && !CROP_ID.test(crop)) {
    return fail('CROP_UNSUPPORTED', 422, requestId);
  }

  const rawTopK = form.get('topK') ?? form.get('top_k');
  let topK: number | undefined;
  if (typeof rawTopK === 'string' && rawTopK.trim()) {
    topK = Number(rawTopK);
    if (!Number.isInteger(topK) || topK < 1 || topK > 10) {
      return fail('TOP_K_INVALID', 422, requestId);
    }
  }

  try {
    const filename = image instanceof File ? image.name.slice(0, 120) : 'upload';
    const result = await diagnose({ image, filename, crop, topK, requestId });
    return ok(result, requestId);
  } catch (error) {
    return failFromError(error, requestId);
  }
}
