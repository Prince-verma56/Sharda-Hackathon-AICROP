/**
 * Farmer crop report as JSON (mobile app). Mirrors the composition of the web report page
 * (app/farmer/(app)/diagnosis/[diagnosisId]/page.tsx): the SAME stored model output, approved
 * guidance, explanation, weather observation, field notes and the farmer's own check history.
 * Nothing here is estimated or invented — values the backend does not have are returned as null
 * with an explicit "unavailable" marker (e.g. severity, heatmap).
 */
import 'server-only';
import { buildDeterministicExplanation } from '@/ai/genai/explain';
import { getMitraSettings } from '@/ai/settings/mitra-settings';
import { FIELD_LABELS, FIELD_OPTIONS, type FieldContext } from '@/lib/cropai/field-context';
import { cropName, splitLabel } from '@/lib/crops';
import { getCropImages } from './crop-images';
import { getDiagnosisForFarmer } from './diagnosis-service';
import { getFieldContext } from './field-context';
import { getApprovedGuidance } from './knowledge';
import { db } from '@/server/db';

export type Lang = 'hi' | 'en';
type ActionKind = 'inspect' | 'prevent' | 'expert' | 'test';

interface ExplanationJson {
  language?: Lang;
  summary: string;
  condition_explanation: string;
  possible_causes: string[];
  recommended_actions: { kind: ActionKind; text: string }[];
  sources: { title: string; url: string | null }[];
}

/** Same wording as the web report. */
export const ADVISORY_LABELS: Record<string, Record<Lang, string>> = {
  CROP_MISMATCH: { hi: 'फोटो चुनी गई फसल से अलग लगती है', en: 'Photo looks like a different crop' },
  WEAK_CROP_UPSTREAM: { hi: 'इस फसल पर मॉडल कम सटीक रहा है', en: 'Model is less accurate for this crop' },
  WEAK_CLASS_UPSTREAM: { hi: 'इस बीमारी पर मॉडल कम भरोसेमंद', en: 'Model is less reliable for this condition' },
  IMAGE_QUALITY: { hi: 'फोटो साफ़ नहीं — दोबारा लें', en: 'Low photo quality — retake' },
  LOW_GLOBAL_EVIDENCE: { hi: 'पत्ती साफ़ नहीं दिख रही', en: 'Leaf not clearly visible' },
};

const ASK_MITRA: Record<Lang, string[]> = {
  hi: ['इस नतीजे का क्या मतलब है?', 'सबसे पहले मुझे क्या करना चाहिए?', 'इसे फैलने से कैसे रोकूँ?', 'दोबारा कब जांच करूँ?'],
  en: ['What does this result mean?', 'What should I do first?', 'How do I stop it spreading?', 'When should I check again?'],
};

/** General scouting steps shown when no expert-approved symptom list exists (condition-independent). */
const GENERAL_SCOUTING: Record<Lang, string[]> = {
  hi: ['पत्तियों के दोनों तरफ़ देखें — ऊपर और नीचे', 'एक कतार के 10 पौधों में से कितने प्रभावित हैं, गिनें', '2–3 दिन बाद दोबारा देखें — क्या धब्बे फैल रहे हैं?'],
  en: ['Look at both sides of the leaves — top and underside', 'Count how many of 10 plants in a row are affected', 'Look again in 2–3 days — are the spots spreading?'],
};

function fieldNotes(ctx: FieldContext | null, lang: Lang) {
  if (!ctx) return null;
  const pick = (key: 'cropStage' | 'firstNoticed' | 'spread' | 'recentWeather' | 'sprayed', value?: string) =>
    value ? ((FIELD_OPTIONS[key] as Record<string, Record<Lang, string>>)[value]?.[lang] ?? null) : null;
  const items = [
    { key: 'cropStage', label: FIELD_LABELS.cropStage[lang], value: pick('cropStage', ctx.cropStage) },
    { key: 'firstNoticed', label: FIELD_LABELS.firstNoticed[lang], value: pick('firstNoticed', ctx.firstNoticed) },
    { key: 'spread', label: FIELD_LABELS.spread[lang], value: pick('spread', ctx.spread) },
    { key: 'parts', label: FIELD_LABELS.parts[lang], value: ctx.parts?.length ? ctx.parts.map((p) => FIELD_OPTIONS.parts[p][lang]).join(', ') : null },
    { key: 'recentWeather', label: FIELD_LABELS.recentWeather[lang], value: pick('recentWeather', ctx.recentWeather) },
    { key: 'sprayed', label: FIELD_LABELS.sprayed[lang], value: pick('sprayed', ctx.sprayed) },
  ].filter((i): i is { key: string; label: string; value: string } => Boolean(i.value));
  return {
    items,
    note: ctx.note ?? null,
    capturedAt: ctx.capturedAt ?? null,
    timeZone: ctx.timeZone ?? null,
    location: ctx.location ? { latitude: ctx.location.latitude, longitude: ctx.location.longitude } : null,
  };
}

/** "Listen to report" script — identical rules to the web report (follows Mitra's language). */
function speechFor(input: { mitraLanguage: 'hinglish' | 'hi' | 'en'; crop: string; condition: string; score: number; healthy: boolean; summary: string | null; actions: { kind: ActionKind; text: string }[] }) {
  const { actions, crop, condition, score, healthy } = input;
  const count = (kind: ActionKind) => actions.filter((a) => a.kind === kind).length;
  const steps = (testWord: string, expert: string) =>
    actions.length
      ? `आगे के ${actions.length} कदम ${input.mitraLanguage === 'hi' ? 'स्क्रीन' : 'screen'} पर हैं — ${[count('inspect') && `${count('inspect')} जांच के`, count('prevent') && `${count('prevent')} बचाव के`, count('test') && `${count('test')} ${testWord}`].filter(Boolean).join(', ')}${count('expert') ? expert : ''}।`
      : '';
  if (input.mitraLanguage === 'en') {
    return { text: [input.summary, ...actions.map((a, i) => `${i + 1}. ${a.text}`)].filter(Boolean).join(' '), locale: 'en-IN' };
  }
  if (input.mitraLanguage === 'hi') {
    return {
      text: [
        `आपकी ${cropName(crop, 'hi')} की फोटो में AI मॉडल को ${condition} जैसे संकेत मिले हैं, मॉडल स्कोर ${score} प्रतिशत।`,
        healthy ? 'पौधा स्वस्थ जैसा दिख रहा है।' : 'यह स्क्रीनिंग है, पक्की पुष्टि नहीं।',
        steps('और जांच के', ', और विशेषज्ञ से सलाह'),
        'ज़्यादा जानकारी के लिए मित्र से पूछिए, या विशेषज्ञ से पुष्टि कराइए।',
      ]
        .filter(Boolean)
        .join(' '),
      locale: 'hi-IN',
    };
  }
  return {
    text: [
      `आपके ${cropName(crop, 'en')} की photo में AI model को ${condition} जैसे संकेत दिखे हैं, model score ${score} percent।`,
      healthy ? 'पौधा healthy दिख रहा है।' : 'यह एक screening है, पक्की diagnosis नहीं।',
      steps('और testing के', ', और expert से सलाह'),
      'और जानकारी के लिए Mitra से बात कीजिए — Ask Mitra दबाइए।',
    ]
      .filter(Boolean)
      .join(' '),
    locale: 'hi-IN',
  };
}

/** Builds the full report for the farmer who owns it, or null (not found / not theirs). */
export async function buildFarmerReport(diagnosisId: string, farmerId: string, lang: Lang) {
  const d = await getDiagnosisForFarmer(diagnosisId, farmerId);
  if (!d) return null;
  const hi = lang === 'hi';
  const [guidance, healthyRef, history, cropImages, mitra, fieldCtx] = await Promise.all([
    getApprovedGuidance(d.predictedLabel),
    d.isHealthy ? null : getApprovedGuidance(`${d.predictedCrop}::Healthy`),
    db.diagnosis.findMany({
      where: { farmerId, predictedCrop: d.predictedCrop },
      orderBy: { createdAt: 'asc' },
      take: 24,
      select: { id: true, createdAt: true, predictedCondition: true, confidence: true, isHealthy: true },
    }),
    getCropImages(),
    getMitraSettings(farmerId),
    getFieldContext(d.id),
  ]);

  const advisories = ((d.advisories as { code: string; message?: string }[]) ?? []).map((a) => ({ code: a.code, label: ADVISORY_LABELS[a.code]?.[lang] ?? a.code }));
  const stored = d.explanation as unknown as ExplanationJson | null;
  // Same rule as the web page: a stored explanation in the other language is rebuilt from the
  // same approved guidance (deterministic template), never re-generated by an LLM here.
  const ex: ExplanationJson | null =
    stored && (stored.language ?? lang) === lang
      ? stored
      : (buildDeterministicExplanation({
          language: lang,
          crop: d.predictedCrop,
          cropDisplay: cropName(d.predictedCrop, lang),
          predictedLabel: d.predictedLabel,
          predictedCondition: d.predictedCondition,
          isHealthy: d.isHealthy,
          modelVersion: d.modelVersion,
          score: d.confidence,
          topPredictions: d.predictions.map((p) => ({ label: p.label, score: p.score })),
          advisories: advisories.map((a) => a.code),
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
          weather: null,
          farmerName: null,
        }).explanation as unknown as ExplanationJson);

  const score = Math.round(d.confidence * 100);
  const actions = ex?.recommended_actions ?? [];
  const review = d.reviews[0] ?? null;
  const raw = (d.rawOutput ?? {}) as { cropSource?: 'user' | 'model' };
  const weather = d.weather;
  const forecast = ((weather?.forecast as { forecast?: { date: string; maxC: number | null; minC: number | null; rainMm: number | null }[] } | null)?.forecast ?? []).slice(0, 5);
  const symptoms = d.knowledge?.symptoms ?? [];
  const speech = speechFor({ mitraLanguage: mitra.effective.language, crop: d.predictedCrop, condition: d.predictedCondition, score, healthy: d.isHealthy, summary: ex?.summary ?? null, actions });
  const when = d.createdAt.toLocaleString(hi ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

  const reference = (entry: { id: string; referenceImageKey: string | null; referenceImageCredit?: string | null } | null | undefined, kind: 'condition' | 'healthy', label: string) =>
    entry?.referenceImageKey ? { kind, label, imageUrl: `/api/v1/images/knowledge/${entry.id}`, credit: entry.referenceImageCredit ?? null } : { kind, label, imageUrl: null, credit: null };

  return {
    id: d.id,
    createdAt: d.createdAt.toISOString(),
    language: lang,
    status: d.status,
    image: { url: `/api/v1/images/diagnoses/${d.id}`, width: d.imageWidth, height: d.imageHeight, expiresAt: d.imageExpiresAt?.toISOString() ?? null },
    crop: {
      id: d.predictedCrop,
      name: cropName(d.predictedCrop, lang),
      imageUrl: cropImages[d.predictedCrop] ?? null,
      selected: d.selectedCrop ? { id: d.selectedCrop, name: cropName(d.selectedCrop, lang) } : null,
      source: raw.cropSource ?? (d.selectedCrop ? 'user' : 'model'),
    },
    result: {
      label: d.predictedLabel,
      condition: d.predictedCondition,
      isHealthy: d.isHealthy,
      score: d.confidence,
      scorePercent: score,
      margin: d.margin,
      scoreType: d.scoreType,
      screeningStatus: d.isHealthy ? 'looks_healthy' : 'needs_attention',
      isLaboratoryConfirmed: false,
      photoQuality: d.qualityStatus,
      qualityWarnings: d.qualityWarnings,
      advisories,
      uncertain: advisories.length > 0,
      /** Not produced by the model or any validated method — always null, never estimated. */
      severity: null,
    },
    model: { name: d.modelName, version: d.modelVersion, inferenceMs: d.inferenceMs },
    predictions: d.predictions.map((p) => ({ rank: p.rank, label: p.label, crop: p.crop, condition: p.condition, score: p.score, isHealthy: p.isHealthy })),
    explanation: ex
      ? {
          source: d.explanationSource ?? 'none',
          summary: ex.summary,
          conditionExplanation: ex.condition_explanation,
          possibleCauses: ex.possible_causes ?? [],
          sources: (ex.sources ?? []).map((s) => ({ title: s.title, url: s.url })),
        }
      : null,
    actions: actions.map((a, i) => ({ step: i + 1, kind: a.kind, text: a.text })),
    lookFor: symptoms.length
      ? { kind: 'approved_symptoms' as const, items: symptoms }
      : { kind: 'general_scouting' as const, items: GENERAL_SCOUTING[lang] },
    guidance: d.knowledge
      ? { id: d.knowledge.id, title: d.knowledge.title, sourceUrl: d.knowledge.sourceUrl, sourceOrganisation: d.knowledge.sourceOrganisation, lastReviewedAt: d.knowledge.lastReviewedAt?.toISOString() ?? null }
      : null,
    references: [
      reference(d.knowledge, 'condition', d.predictedCondition),
      ...(healthyRef ? [reference(healthyRef, 'healthy', hi ? 'स्वस्थ पौधा' : 'Healthy plant')] : []),
    ],
    weather: weather
      ? {
          provider: weather.provider,
          observedAt: weather.observedAt.toISOString(),
          fetchedAt: weather.fetchedAt.toISOString(),
          temperatureC: weather.temperatureC,
          humidityPct: weather.humidityPct,
          rainLast24hMm: weather.rainLast24hMm,
          rainLast72hMm: weather.rainLast72hMm,
          forecast: forecast.map((f) => ({ date: f.date, maxC: f.maxC, minC: f.minC, rainMm: f.rainMm })),
          note: hi ? 'केवल मौसम की जानकारी — बीमारी का खतरा नहीं बताती।' : 'Context only — not a disease-risk prediction.',
        }
      : null,
    fieldNotes: fieldNotes(fieldCtx, lang),
    review: {
      status: d.reviewStatus,
      requestedAt: d.reviewRequestedAt?.toISOString() ?? null,
      latest: review ? { verdict: review.verdict, note: review.note, correctedCondition: review.correctedLabel ? splitLabel(review.correctedLabel).condition : null, createdAt: review.createdAt.toISOString() } : null,
    },
    feedback: d.feedback[0] ? { helpful: d.feedback[0].helpful, comment: d.feedback[0].comment } : null,
    history: history.map((h) => ({ id: h.id, createdAt: h.createdAt.toISOString(), condition: h.predictedCondition, score: h.confidence, isHealthy: h.isHealthy, current: h.id === d.id })),
    heatmap: { available: false, reason: 'The AgriSmart service does not provide a validated explanation map.' },
    speech,
    shareText: `${cropName(d.predictedCrop, lang)}: ${d.predictedCondition} (${hi ? 'मॉडल स्कोर' : 'model score'} ${score}%) — ${when}. ${hi ? 'AI जांच, लैब पुष्टि नहीं।' : 'AI screening, not lab-confirmed.'}`,
    askMitra: ASK_MITRA[lang],
    disclaimer: hi
      ? 'यह AI स्क्रीनिंग है, लैब जांच नहीं। कोई भी दवा इस्तेमाल करने से पहले कृषि विशेषज्ञ से सलाह लें।'
      : 'This is an AI screening, not a lab test. Consult an agriculture expert before using any chemical.',
  };
}

export type FarmerReport = NonNullable<Awaited<ReturnType<typeof buildFarmerReport>>>;
