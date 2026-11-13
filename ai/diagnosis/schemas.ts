/**
 * Contracts for the private AgriSmart inference service (snake_case, Python side)
 * and the application DTOs (camelCase) returned by Next.js API routes.
 *
 * Upstream responses are validated so a misbehaving service can never leak
 * unexpected fields or fake "real" predictions into the app.
 */
import { z } from 'zod';

const classMetrics = z.object({
  precision: z.number(),
  recall: z.number(),
  f1: z.number(),
  support: z.number(),
});

const cropMetrics = z.object({
  test_images: z.number(),
  macro_f1: z.number(),
  accuracy: z.number(),
});

export const upstreamHealthSchema = z.object({
  status: z.enum(['healthy', 'loading', 'degraded']),
  model_loaded: z.boolean(),
  model_state: z.enum(['loading', 'ready', 'failed']),
  model_version: z.string().nullable(),
  model_sha256: z.string().nullable(),
  device: z.string().nullable(),
  mode: z.enum(['real', 'unavailable']),
  error_code: z.string().nullable(),
  load_ms: z.number().nullable(),
  uptime_s: z.number(),
  requests_served: z.number(),
});

export const upstreamCropsSchema = z.object({
  success: z.literal(true),
  model_version: z.string(),
  crop_count: z.number(),
  class_count: z.number(),
  crops: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      class_count: z.number(),
      classes: z.array(
        z.object({
          label: z.string(),
          name: z.string(),
          is_healthy: z.boolean(),
          upstream_metrics: classMetrics.nullable().optional(),
        }),
      ),
      upstream_metrics: cropMetrics.nullable().optional(),
    }),
  ),
});

const probability = z.number().min(0).max(1);

export const upstreamDiagnosisSchema = z.object({
  success: z.literal(true),
  request_id: z.string(),
  model: z.string(),
  model_version: z.string(),
  model_sha256: z.string(),
  inference_mode: z.literal('real'),
  device: z.string(),
  crop: z.string().nullable(),
  crop_source: z.enum(['user', 'model']),
  predicted_crop: z.string(),
  predicted_class: z.string(),
  predicted_label: z.string(),
  is_healthy: z.boolean(),
  confidence: probability,
  margin: z.number(),
  global_top: z.object({ label: z.string(), raw_score: probability }),
  score_type: z.enum(['crop_conditioned_softmax', 'global_softmax']),
  top_predictions: z
    .array(
      z.object({
        label: z.string(),
        crop: z.string(),
        class: z.string(),
        score: probability,
        raw_score: probability,
        is_healthy: z.boolean(),
        upstream_metrics: classMetrics.nullable().optional(),
      }),
    )
    .min(1),
  crop_scores: z.array(z.object({ crop: z.string(), score: probability })),
  selected_crop_mass: probability.nullable(),
  image_quality: z.object({
    status: z.enum(['ok', 'warning']),
    method: z.literal('heuristic'),
    width: z.number(),
    height: z.number(),
    brightness: z.number(),
    contrast: z.number(),
    sharpness: z.number(),
    warnings: z.array(z.object({ code: z.string(), message: z.string() })),
  }),
  assessment: z.object({
    status: z.literal('REVIEW_REQUIRED'),
    reasons: z.array(z.string()),
    advisories: z.array(z.object({ code: z.string(), message: z.string(), basis: z.string() })),
  }),
  is_laboratory_confirmed: z.literal(false),
  preprocessing: z.string(),
  latency_ms: z.number(),
  inference_ms: z.number(),
  disclaimer: z.string(),
});

export const upstreamErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), request_id: z.string().optional() }),
});

export type UpstreamHealth = z.infer<typeof upstreamHealthSchema>;
export type UpstreamCrops = z.infer<typeof upstreamCropsSchema>;
export type UpstreamDiagnosis = z.infer<typeof upstreamDiagnosisSchema>;

// ---- Application DTOs ---------------------------------------------------------------

export interface InferenceStatus {
  reachable: boolean;
  status: 'healthy' | 'loading' | 'degraded' | 'offline';
  modelLoaded: boolean;
  modelVersion: string | null;
  modelSha256: string | null;
  device: string | null;
  mode: 'real' | 'unavailable';
  errorCode: string | null;
  loadMs: number | null;
  uptimeSeconds: number | null;
  requestsServed: number | null;
}

export interface CropClassDto {
  label: string;
  name: string;
  isHealthy: boolean;
  upstreamMetrics: { precision: number; recall: number; f1: number; support: number } | null;
}

export interface CropDto {
  id: string;
  name: string;
  classCount: number;
  classes: CropClassDto[];
  upstreamMetrics: { testImages: number; macroF1: number; accuracy: number } | null;
}

export interface CropCatalogueDto {
  modelVersion: string;
  cropCount: number;
  classCount: number;
  crops: CropDto[];
}

export interface PredictionDto {
  label: string;
  crop: string;
  condition: string;
  score: number;
  rawScore: number;
  isHealthy: boolean;
  upstreamMetrics: CropClassDto['upstreamMetrics'];
}

export interface DiagnosisDto {
  requestId: string;
  model: string;
  modelVersion: string;
  modelSha256: string;
  inferenceMode: 'real';
  device: string;
  selectedCrop: string | null;
  cropSource: 'user' | 'model';
  predictedCrop: string;
  predictedCondition: string;
  predictedLabel: string;
  isHealthy: boolean;
  confidence: number;
  margin: number;
  globalTop: { label: string; rawScore: number };
  scoreType: 'crop_conditioned_softmax' | 'global_softmax';
  topPredictions: PredictionDto[];
  cropScores: { crop: string; score: number }[];
  selectedCropMass: number | null;
  imageQuality: UpstreamDiagnosis['image_quality'];
  assessment: UpstreamDiagnosis['assessment'];
  isLaboratoryConfirmed: false;
  preprocessing: string;
  latencyMs: number;
  inferenceMs: number;
  /** Total time seen by the Next.js server, including network and upload forwarding. */
  roundTripMs: number;
  disclaimer: string;
}
