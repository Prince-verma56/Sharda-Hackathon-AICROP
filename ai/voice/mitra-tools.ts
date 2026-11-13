/**
 * Mitra's restricted tools. Shared by the Vapi tool webhook and the LangGraph text assistant.
 * The farmer identity ALWAYS comes from the server-side session (`farmerId` argument here is
 * resolved by the caller from an authenticated session) — never from model/tool arguments.
 * No tool exposes admin data, phone numbers or other farmers' records.
 */
import 'server-only';
import { cropName, splitLabel } from '@/lib/crops';
import { auditService } from '@/server/audit';
import { getApprovedGuidance } from '@/server/cropai/knowledge';
import { fetchWeather } from '@/server/cropai/weather';
import { db } from '@/server/db';

export type MitraToolName =
  | 'get_farmer_profile'
  | 'get_current_farm'
  | 'get_current_diagnosis'
  | 'get_previous_diagnoses'
  | 'get_local_weather'
  | 'get_approved_crop_guidance'
  | 'submit_farmer_feedback'
  | 'request_expert_assistance';

export interface MitraScope {
  farmerId: string;
  /** Diagnosis the session was opened for (already ownership-checked), if any. */
  activeDiagnosisId: string | null;
  language: 'hi' | 'en';
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

async function ownDiagnosis(scope: MitraScope, diagnosisId?: string | null) {
  const id = diagnosisId ?? scope.activeDiagnosisId;
  return id
    ? db.diagnosis.findFirst({ where: { id, farmerId: scope.farmerId }, include: { predictions: { orderBy: { rank: 'asc' }, take: 3 } } })
    : db.diagnosis.findFirst({ where: { farmerId: scope.farmerId }, orderBy: { createdAt: 'desc' }, include: { predictions: { orderBy: { rank: 'asc' }, take: 3 } } });
}

export async function runMitraTool(name: string, args: Record<string, unknown>, scope: MitraScope): Promise<Record<string, unknown>> {
  switch (name as MitraToolName) {
    case 'get_farmer_profile': {
      const profile = await db.farmerProfile.findUnique({ where: { userId: scope.farmerId } });
      return {
        preferred_name: profile?.preferredName ?? null,
        language: profile?.language ?? scope.language,
        district: profile?.district ?? null,
        state: profile?.state ?? null,
        main_crops: (profile?.mainCrops ?? []).map((c) => cropName(c, scope.language)),
      };
    }
    case 'get_current_farm': {
      const farm = await db.farm.findFirst({ where: { ownerId: scope.farmerId, isPrimary: true }, include: { cropRecords: true } });
      if (!farm) return { farm: null, note: 'No farm saved yet.' };
      return {
        name: farm.name,
        location: farm.locationLabel,
        has_coordinates: farm.latitude != null,
        area_acres: farm.areaAcres ? Number(farm.areaAcres) : null,
        crops_checked: farm.cropRecords.map((c) => cropName(c.crop, scope.language)),
      };
    }
    case 'get_current_diagnosis': {
      const d = await ownDiagnosis(scope, typeof args.diagnosis_id === 'string' ? args.diagnosis_id : null);
      if (!d) return { diagnosis: null, note: 'No crop check found for this farmer.' };
      const explanation = d.explanation as { summary?: string; recommended_actions?: { kind: string; text: string }[] } | null;
      return {
        date: d.createdAt.toISOString().slice(0, 10),
        crop: cropName(d.predictedCrop, scope.language),
        predicted_condition: d.predictedCondition,
        is_healthy: d.isHealthy,
        model_score: pct(d.confidence),
        score_meaning: 'Classifier output, not certainty. Laboratory confirmation not done.',
        alternatives: d.predictions.slice(1).map((p) => `${splitLabel(p.label).condition} (${pct(p.score)})`),
        warnings: (d.advisories as { code: string }[]).map((a) => a.code),
        expert_review_status: d.reviewStatus,
        summary: explanation?.summary ?? null,
        next_steps: explanation?.recommended_actions?.map((a) => a.text) ?? [],
        severity: 'Not assessed',
      };
    }
    case 'get_previous_diagnoses': {
      const rows = await db.diagnosis.findMany({
        where: { farmerId: scope.farmerId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(args.limit) || 5, 10),
        select: { createdAt: true, predictedCrop: true, predictedCondition: true, confidence: true, reviewStatus: true },
      });
      return {
        count: rows.length,
        reports: rows.map((r) => ({
          date: r.createdAt.toISOString().slice(0, 10),
          crop: cropName(r.predictedCrop, scope.language),
          condition: r.predictedCondition,
          model_score: pct(r.confidence),
          review: r.reviewStatus,
        })),
      };
    }
    case 'get_local_weather': {
      const farm = await db.farm.findFirst({ where: { ownerId: scope.farmerId, isPrimary: true } });
      if (farm?.latitude == null || farm.longitude == null) return { weather: null, note: 'Farm location not saved. Ask the farmer to add it in the profile.' };
      try {
        const w = await fetchWeather(farm.latitude, farm.longitude);
        return {
          provider: 'Open-Meteo',
          observed_at: w.observedAt,
          temperature_c: w.temperatureC,
          humidity_pct: w.humidityPct,
          rain_last_24h_mm: w.rainLast24hMm,
          next_days: w.forecast.slice(0, 3),
          note: 'Weather context only; it does not predict disease.',
        };
      } catch {
        return { weather: null, note: 'Weather service unavailable right now.' };
      }
    }
    case 'get_approved_crop_guidance': {
      const d = typeof args.condition_label === 'string' ? null : await ownDiagnosis(scope);
      const label = typeof args.condition_label === 'string' ? args.condition_label : d?.predictedLabel;
      if (!label) return { guidance: null, note: 'No condition to look up.' };
      const g = await getApprovedGuidance(label);
      if (!g) return { guidance: null, note: 'No expert-approved guidance for this condition yet. Advise contacting the local agriculture officer.' };
      return {
        title: g.title,
        summary: g.summary,
        symptoms: g.symptoms,
        inspection_steps: g.inspectionSteps,
        prevention: g.prevention,
        approved_treatment: g.approvedTreatment,
        source: g.sourceOrganisation,
        last_reviewed: g.lastReviewedAt?.toISOString().slice(0, 10) ?? null,
      };
    }
    case 'submit_farmer_feedback': {
      const d = await ownDiagnosis(scope);
      if (!d) return { saved: false, note: 'No report to give feedback on.' };
      const helpful = Boolean(args.helpful);
      const comment = typeof args.comment === 'string' ? args.comment.slice(0, 500) : null;
      await db.diagnosisFeedback.upsert({
        where: { diagnosisId_farmerId: { diagnosisId: d.id, farmerId: scope.farmerId } },
        create: { diagnosisId: d.id, farmerId: scope.farmerId, helpful, comment },
        update: { helpful, comment },
      });
      return { saved: true };
    }
    case 'request_expert_assistance': {
      const d = await ownDiagnosis(scope);
      if (!d) return { requested: false, note: 'No report found to send to an expert.' };
      if (d.reviewStatus !== 'CONFIRMED' && d.reviewStatus !== 'CHALLENGED') {
        await db.diagnosis.update({ where: { id: d.id }, data: { reviewStatus: 'PENDING', reviewRequestedAt: new Date() } });
      }
      await auditService.audit({ actorId: scope.farmerId, action: 'diagnosis.expert_requested', resource: 'diagnosis', resourceId: d.id, metadata: { via: 'voice' } });
      return { requested: true, note: 'An agriculture expert will review this report.' };
    }
    default:
      return { error: 'UNKNOWN_TOOL' };
  }
}

/** Vapi function-tool definitions (JSON Schema). Identity is never a parameter. */
export const MITRA_TOOL_DEFINITIONS = [
  { name: 'get_farmer_profile', description: "The signed-in farmer's preferred name, language, district and main crops.", parameters: { type: 'object', properties: {} } },
  { name: 'get_current_farm', description: "The farmer's saved farm and crops checked.", parameters: { type: 'object', properties: {} } },
  { name: 'get_current_diagnosis', description: 'The crop check report being discussed (or the latest one): model result, alternatives, warnings and next steps.', parameters: { type: 'object', properties: {} } },
  { name: 'get_previous_diagnoses', description: "The farmer's recent crop check reports.", parameters: { type: 'object', properties: { limit: { type: 'number', description: 'How many (max 10)' } } } },
  { name: 'get_local_weather', description: 'Current weather context and short forecast for the farm (context only, not disease risk).', parameters: { type: 'object', properties: {} } },
  { name: 'get_approved_crop_guidance', description: 'Expert-approved guidance for the current diagnosis condition. Only source for prevention/treatment advice.', parameters: { type: 'object', properties: {} } },
  { name: 'submit_farmer_feedback', description: 'Save whether the report was helpful.', parameters: { type: 'object', properties: { helpful: { type: 'boolean' }, comment: { type: 'string' } }, required: ['helpful'] } },
  { name: 'request_expert_assistance', description: 'Ask an agriculture expert to review the current report.', parameters: { type: 'object', properties: {} } },
] as const;
