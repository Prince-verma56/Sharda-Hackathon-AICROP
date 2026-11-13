/**
 * Structured explanation contract shared by the LLM path and the deterministic
 * approved-guidance path. The LLM never decides the diagnosis; it only explains it.
 */
import { z } from 'zod';

export const explanationSchema = z.object({
  language: z.enum(['hi', 'en']),
  summary: z.string().min(1).max(600),
  condition_explanation: z.string().max(1500).default(''),
  possible_causes: z.array(z.string().max(300)).max(6).default([]),
  recommended_actions: z
    .array(
      z.object({
        kind: z.enum(['inspect', 'prevent', 'expert', 'test']),
        text: z.string().min(1).max(400),
      }),
    )
    .max(10)
    .default([]),
  precautions: z.array(z.string().max(300)).max(6).default([]),
  expert_verification_required: z.literal(true),
  sources: z.array(z.object({ title: z.string(), url: z.string().url().nullable() })).max(6).default([]),
});

export type Explanation = z.infer<typeof explanationSchema>;

export interface ExplanationInput {
  language: 'hi' | 'en';
  crop: string;
  cropDisplay: string;
  predictedLabel: string;
  predictedCondition: string;
  isHealthy: boolean;
  modelVersion: string;
  /** Crop-conditioned softmax score of the top class (model output, not certainty). */
  score: number;
  topPredictions: { label: string; score: number }[];
  advisories: string[];
  guidance: {
    title: string;
    summary: string;
    symptoms: string[];
    causes: string[];
    inspectionSteps: string[];
    prevention: string[];
    approvedTreatment: string[];
    furtherTesting: string[];
    sourceUrl: string | null;
    sourceOrganisation: string | null;
  } | null;
  weather: { temperatureC: number | null; humidityPct: number | null; rainLast24hMm: number | null } | null;
  farmerName: string | null;
}
