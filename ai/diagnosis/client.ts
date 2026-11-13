/**
 * Server-only client for the private AgriSmart FastAPI inference service.
 *
 * The browser never talks to the Python service: Next.js route handlers call these
 * functions, which attach the server-only bearer token and validate every response.
 */
import 'server-only';
import { z } from 'zod';
import {
  type CropCatalogueDto,
  type DiagnosisDto,
  type InferenceStatus,
  type UpstreamDiagnosis,
  upstreamCropsSchema,
  upstreamDiagnosisSchema,
  upstreamErrorSchema,
  upstreamHealthSchema,
} from './schemas';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const envSchema = z.object({
  AI_INFERENCE_BASE_URL: z.url().default('http://localhost:8001'),
  AI_SERVICE_TOKEN: z.string().min(32).optional(),
  AI_INFERENCE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(65000),
});

export function getInferenceConfig() {
  const parsed = envSchema.safeParse({
    AI_INFERENCE_BASE_URL: process.env.AI_INFERENCE_BASE_URL || undefined,
    AI_SERVICE_TOKEN: process.env.AI_SERVICE_TOKEN || undefined,
    AI_INFERENCE_TIMEOUT_MS: process.env.AI_INFERENCE_TIMEOUT_MS || undefined,
  });
  if (!parsed.success) {
    throw new InferenceClientError('INFERENCE_NOT_CONFIGURED', 503);
  }
  return {
    baseUrl: parsed.data.AI_INFERENCE_BASE_URL.replace(/\/+$/, ''),
    token: parsed.data.AI_SERVICE_TOKEN,
    timeoutMs: parsed.data.AI_INFERENCE_TIMEOUT_MS,
  };
}

/** Error codes the browser may see. Anything else from upstream is collapsed to INFERENCE_FAILED. */
const PASSTHROUGH_CODES = new Set([
  'IMAGE_REQUIRED',
  'IMAGE_SIZE_INVALID',
  'IMAGE_PIXEL_LIMIT',
  'IMAGE_FORMAT_UNSUPPORTED',
  'IMAGE_INVALID',
  'IMAGE_DIMENSIONS_OR_ANIMATION_INVALID',
  'CROP_UNSUPPORTED',
  'TOP_K_INVALID',
  'INFERENCE_BUSY',
  'MODEL_LOADING',
  'MODEL_UNAVAILABLE',
  'INFERENCE_TIMEOUT',
]);

export const ERROR_MESSAGES: Record<string, string> = {
  INFERENCE_NOT_CONFIGURED: 'The diagnosis service is not configured on this server.',
  INFERENCE_OFFLINE: 'The diagnosis service is offline. Start the FastAPI inference service.',
  INFERENCE_TIMEOUT: 'The diagnosis took too long. Please try again.',
  INFERENCE_BAD_RESPONSE: 'The diagnosis service returned an invalid response.',
  INFERENCE_FAILED: 'The diagnosis failed unexpectedly.',
  INFERENCE_BUSY: 'The model is busy with other photos. Retry in a few seconds.',
  MODEL_LOADING: 'The model is still loading. Retry in a few seconds.',
  MODEL_UNAVAILABLE: 'The crop disease model is not loaded on the inference service.',
  IMAGE_REQUIRED: 'Attach a leaf photo to diagnose.',
  IMAGE_SIZE_INVALID: 'The photo is empty or larger than 8 MB.',
  IMAGE_PIXEL_LIMIT: 'The photo has more than 20 megapixels. Use a smaller photo.',
  IMAGE_FORMAT_UNSUPPORTED: 'Only JPEG, PNG and WebP photos are supported.',
  IMAGE_INVALID: 'The file could not be read as an image.',
  IMAGE_DIMENSIONS_OR_ANIMATION_INVALID: 'The photo must be a single still image at least 64 px wide and tall.',
  CROP_UNSUPPORTED: 'The selected crop is not supported by this model.',
  TOP_K_INVALID: 'topK must be between 1 and 10.',
  INVALID_FORM: 'Send the photo as multipart form data.',
};

export class InferenceClientError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly upstreamRequestId?: string,
  ) {
    super(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INFERENCE_FAILED);
    this.name = 'InferenceClientError';
  }
}

async function call(path: string, init: RequestInit & { timeoutMs?: number; auth?: boolean } = {}) {
  const config = getInferenceConfig();
  if (init.auth !== false && !config.token) {
    throw new InferenceClientError('INFERENCE_NOT_CONFIGURED', 503);
  }
  const headers = new Headers(init.headers);
  if (init.auth !== false) headers.set('Authorization', `Bearer ${config.token}`);
  try {
    return await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(init.timeoutMs ?? config.timeoutMs),
    });
  } catch (error) {
    const name = (error as Error)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new InferenceClientError('INFERENCE_TIMEOUT', 504);
    }
    throw new InferenceClientError('INFERENCE_OFFLINE', 503);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new InferenceClientError('INFERENCE_BAD_RESPONSE', 502);
  }
}

function toUpstreamError(response: Response, body: unknown): InferenceClientError {
  const parsed = upstreamErrorSchema.safeParse(body);
  if (parsed.success && PASSTHROUGH_CODES.has(parsed.data.error.code)) {
    return new InferenceClientError(parsed.data.error.code, response.status, parsed.data.error.request_id);
  }
  if (response.status === 401) return new InferenceClientError('INFERENCE_NOT_CONFIGURED', 503);
  return new InferenceClientError('INFERENCE_FAILED', 502);
}

// ---- Status --------------------------------------------------------------------------

export async function getInferenceStatus(): Promise<InferenceStatus> {
  const offline: InferenceStatus = {
    reachable: false,
    status: 'offline',
    modelLoaded: false,
    modelVersion: null,
    modelSha256: null,
    device: null,
    mode: 'unavailable',
    errorCode: null,
    loadMs: null,
    uptimeSeconds: null,
    requestsServed: null,
  };
  let response: Response;
  try {
    response = await call('/health', { auth: false, timeoutMs: 3000 });
  } catch (error) {
    return { ...offline, errorCode: (error as InferenceClientError).code };
  }
  const parsed = upstreamHealthSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return { ...offline, reachable: true, errorCode: 'INFERENCE_BAD_RESPONSE' };
  const h = parsed.data;
  return {
    reachable: true,
    status: h.status,
    modelLoaded: h.model_loaded,
    modelVersion: h.model_version,
    modelSha256: h.model_sha256,
    device: h.device,
    mode: h.mode,
    errorCode: h.error_code,
    loadMs: h.load_ms,
    uptimeSeconds: h.uptime_s,
    requestsServed: h.requests_served,
  };
}

// ---- Crop catalogue (cached per server process; taxonomy is bound to the checkpoint) ----

let catalogueCache: { value: CropCatalogueDto; expiresAt: number } | null = null;
const CATALOGUE_TTL_MS = 10 * 60 * 1000;

export async function getCropCatalogue(): Promise<CropCatalogueDto> {
  if (catalogueCache && catalogueCache.expiresAt > Date.now()) return catalogueCache.value;
  const response = await call('/v1/crops', { timeoutMs: 10000 });
  const body = await readJson(response);
  if (!response.ok) throw toUpstreamError(response, body);
  const parsed = upstreamCropsSchema.safeParse(body);
  if (!parsed.success) throw new InferenceClientError('INFERENCE_BAD_RESPONSE', 502);
  const value: CropCatalogueDto = {
    modelVersion: parsed.data.model_version,
    cropCount: parsed.data.crop_count,
    classCount: parsed.data.class_count,
    crops: parsed.data.crops.map((crop) => ({
      id: crop.id,
      name: crop.name,
      classCount: crop.class_count,
      classes: crop.classes.map((item) => ({
        label: item.label,
        name: item.name,
        isHealthy: item.is_healthy,
        upstreamMetrics: item.upstream_metrics ?? null,
      })),
      upstreamMetrics: crop.upstream_metrics
        ? {
            testImages: crop.upstream_metrics.test_images,
            macroF1: crop.upstream_metrics.macro_f1,
            accuracy: crop.upstream_metrics.accuracy,
          }
        : null,
    })),
  };
  catalogueCache = { value, expiresAt: Date.now() + CATALOGUE_TTL_MS };
  return value;
}

// ---- Diagnosis -----------------------------------------------------------------------

export interface DiagnoseInput {
  image: Blob;
  filename?: string;
  crop?: string | null;
  topK?: number;
  requestId?: string;
}

export function toDiagnosisDto(d: UpstreamDiagnosis, roundTripMs: number): DiagnosisDto {
  return {
    requestId: d.request_id,
    model: d.model,
    modelVersion: d.model_version,
    modelSha256: d.model_sha256,
    inferenceMode: d.inference_mode,
    device: d.device,
    selectedCrop: d.crop,
    cropSource: d.crop_source,
    predictedCrop: d.predicted_crop,
    predictedCondition: d.predicted_class,
    predictedLabel: d.predicted_label,
    isHealthy: d.is_healthy,
    confidence: d.confidence,
    margin: d.margin,
    globalTop: { label: d.global_top.label, rawScore: d.global_top.raw_score },
    scoreType: d.score_type,
    topPredictions: d.top_predictions.map((p) => ({
      label: p.label,
      crop: p.crop,
      condition: p.class,
      score: p.score,
      rawScore: p.raw_score,
      isHealthy: p.is_healthy,
      upstreamMetrics: p.upstream_metrics ?? null,
    })),
    cropScores: d.crop_scores,
    selectedCropMass: d.selected_crop_mass,
    imageQuality: d.image_quality,
    assessment: d.assessment,
    isLaboratoryConfirmed: d.is_laboratory_confirmed,
    preprocessing: d.preprocessing,
    latencyMs: d.latency_ms,
    inferenceMs: d.inference_ms,
    roundTripMs,
    disclaimer: d.disclaimer,
  };
}

export async function diagnose(input: DiagnoseInput): Promise<DiagnosisDto> {
  const started = performance.now();
  const form = new FormData();
  form.set('image', input.image, input.filename || 'upload');
  if (input.crop) form.set('crop', input.crop);
  if (input.topK !== undefined) form.set('top_k', String(input.topK));
  const headers: Record<string, string> = {};
  if (input.requestId) headers['X-Request-ID'] = input.requestId;

  const response = await call('/v1/predict', { method: 'POST', body: form, headers });
  const body = await readJson(response);
  if (!response.ok) throw toUpstreamError(response, body);
  const parsed = upstreamDiagnosisSchema.safeParse(body);
  if (!parsed.success) throw new InferenceClientError('INFERENCE_BAD_RESPONSE', 502);
  return toDiagnosisDto(parsed.data, Math.round(performance.now() - started));
}
