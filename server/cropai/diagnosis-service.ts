/**
 * Farmer diagnosis pipeline (one real model call per photo, never mocked):
 *   validate -> AgriSmart inference (FastAPI) -> store cleaned photo -> transaction
 *   (Diagnosis + ModelPrediction[] + CropRecord) -> weather context -> approved guidance
 *   -> explanation (LLM or approved guidance) -> notification + audit.
 */
import 'server-only';
import type { Prisma } from '@prisma/client';
import { diagnose, InferenceClientError, type DiagnosisDto } from '@/ai/diagnosis';
import { generateExplanation } from '@/ai/genai/explain';
import { cropName } from '@/lib/crops';
import { auditService } from '@/server/audit';
import { db } from '@/server/db';
import { notificationService } from '@/server/notifications';
import { deleteImage, storeImage } from './image-store';
import { getApprovedGuidance } from './knowledge';
import { getSettings } from './settings';
import { recordWeatherForFarm } from './weather';

export class DiagnosisError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

export interface CreateDiagnosisInput {
  farmerId: string;
  image: Blob;
  filename: string;
  crop: string | null;
  language: 'hi' | 'en';
  farmerName: string | null;
}

export async function getPrimaryFarm(farmerId: string) {
  return db.farm.findFirst({ where: { ownerId: farmerId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] });
}

export async function createDiagnosis(input: CreateDiagnosisInput) {
  // 1. Real model inference. Failures surface as errors — never a fabricated result.
  let result: DiagnosisDto;
  try {
    result = await diagnose({ image: input.image, filename: input.filename, crop: input.crop, topK: 5 });
  } catch (error) {
    if (error instanceof InferenceClientError) throw new DiagnosisError(error.code, error.status);
    throw new DiagnosisError('INFERENCE_FAILED', 502);
  }

  // 2. Persist a metadata-free copy of the photo (consented at onboarding/upload).
  const settings = await getSettings();
  const stored = await storeImage(Buffer.from(await input.image.arrayBuffer()), 'diagnoses');
  const farm = await getPrimaryFarm(input.farmerId);
  const uncertain = result.assessment.advisories.length > 0;

  // 3. Atomic write of the diagnosis, its ranked predictions and the crop record.
  let diagnosis;
  try {
    diagnosis = await db.$transaction(async (tx) => {
      const cropRecord = farm
        ? await tx.cropRecord.upsert({
            where: { farmId_crop: { farmId: farm.id, crop: result.predictedCrop } },
            create: { farmId: farm.id, crop: result.predictedCrop },
            update: {},
          })
        : null;
      return tx.diagnosis.create({
        data: {
          farmerId: input.farmerId,
          farmId: farm?.id ?? null,
          cropRecordId: cropRecord?.id ?? null,
          selectedCrop: result.selectedCrop,
          imageKey: stored.key,
          imageSha256: stored.sha256,
          imageMime: stored.mime,
          imageBytes: stored.bytes,
          imageWidth: stored.width,
          imageHeight: stored.height,
          originalFilename: input.filename.slice(0, 120),
          imageExpiresAt: new Date(Date.now() + settings.image_retention_days * 86_400_000),
          modelName: result.model,
          modelVersion: result.modelVersion,
          modelSha256: result.modelSha256,
          predictedLabel: result.predictedLabel,
          predictedCrop: result.predictedCrop,
          predictedCondition: result.predictedCondition,
          isHealthy: result.isHealthy,
          confidence: result.confidence,
          margin: result.margin,
          globalTopLabel: result.globalTop.label,
          globalTopScore: result.globalTop.rawScore,
          scoreType: result.scoreType,
          inferenceMs: result.inferenceMs,
          latencyMs: result.roundTripMs,
          qualityStatus: result.imageQuality.status,
          qualityWarnings: result.imageQuality.warnings as unknown as Prisma.InputJsonValue,
          advisories: result.assessment.advisories as unknown as Prisma.InputJsonValue,
          rawOutput: result as unknown as Prisma.InputJsonValue,
          reviewStatus: uncertain && settings.auto_queue_uncertain_for_review ? 'PENDING' : 'UNREVIEWED',
          reviewRequestedAt: uncertain && settings.auto_queue_uncertain_for_review ? new Date() : null,
          predictions: {
            create: result.topPredictions.map((p, index) => ({
              rank: index + 1,
              label: p.label,
              crop: p.crop,
              condition: p.condition,
              score: p.score,
              rawScore: p.rawScore,
              isHealthy: p.isHealthy,
            })),
          },
        },
      });
    });
  } catch (error) {
    await deleteImage(stored.key);
    throw error;
  }

  // 4. Context: weather (if the farm has a location) and approved guidance.
  const weather = farm ? await recordWeatherForFarm(farm) : null;
  const guidance = await getApprovedGuidance(result.predictedLabel);

  // 5. Explanation (LLM if configured and it passes guardrails; otherwise approved guidance).
  const explained = await generateExplanation({
    language: input.language,
    crop: result.predictedCrop,
    cropDisplay: cropName(result.predictedCrop, input.language),
    predictedLabel: result.predictedLabel,
    predictedCondition: result.predictedCondition,
    isHealthy: result.isHealthy,
    modelVersion: result.modelVersion,
    score: result.confidence,
    topPredictions: result.topPredictions.map((p) => ({ label: p.label, score: p.score })),
    advisories: result.assessment.advisories.map((a) => a.code),
    guidance: guidance
      ? {
          title: guidance.title,
          summary: guidance.summary,
          symptoms: guidance.symptoms,
          causes: guidance.causes,
          inspectionSteps: guidance.inspectionSteps,
          prevention: guidance.prevention,
          approvedTreatment: guidance.approvedTreatment,
          furtherTesting: guidance.furtherTesting,
          sourceUrl: guidance.sourceUrl,
          sourceOrganisation: guidance.sourceOrganisation,
        }
      : null,
    weather: weather
      ? { temperatureC: weather.weather.temperatureC, humidityPct: weather.weather.humidityPct, rainLast24hMm: weather.weather.rainLast24hMm }
      : null,
    farmerName: input.farmerName,
  });

  const updated = await db.diagnosis.update({
    where: { id: diagnosis.id },
    data: {
      weatherObservationId: weather?.observation.id ?? null,
      knowledgeEntryId: guidance?.id ?? null,
      explanation: explained.explanation as unknown as Prisma.InputJsonValue,
      explanationSource: explained.source,
      explanationLanguage: input.language,
    },
  });

  await notificationService
    .notify({
      userId: input.farmerId,
      type: 'diagnosis.completed',
      title: input.language === 'hi' ? 'फसल जांच पूरी हुई' : 'Crop check complete',
      message: `${cropName(result.predictedCrop, input.language)}: ${result.predictedCondition}`,
      channel: 'in-app',
      metadata: { diagnosisId: diagnosis.id },
    })
    .catch(() => undefined);
  await auditService.audit({
    actorId: input.farmerId,
    action: 'diagnosis.create',
    resource: 'diagnosis',
    resourceId: diagnosis.id,
    metadata: { modelVersion: result.modelVersion, label: result.predictedLabel, explanationSource: explained.source, rejectedReason: explained.rejectedReason ?? null },
  });
  return updated;
}

/** Full report data for an owner (farmer) — returns null if not theirs. */
export async function getDiagnosisForFarmer(diagnosisId: string, farmerId: string) {
  return db.diagnosis.findFirst({
    where: { id: diagnosisId, farmerId },
    include: {
      predictions: { orderBy: { rank: 'asc' } },
      weather: true,
      knowledge: { select: { id: true, title: true, summary: true, symptoms: true, sourceUrl: true, sourceOrganisation: true, referenceImageKey: true, referenceImageCredit: true, lastReviewedAt: true, status: true } },
      reviews: { orderBy: { createdAt: 'desc' }, take: 1, select: { verdict: true, note: true, correctedLabel: true, createdAt: true } },
      feedback: { where: { farmerId }, select: { helpful: true, comment: true } },
    },
  });
}
