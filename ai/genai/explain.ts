/**
 * Farmer-friendly explanation of a REAL model result.
 *
 * Order of preference:
 *   1. LLM (if GENAI_* configured) — output must pass schema + guardrails, else discarded.
 *   2. Deterministic text built only from APPROVED guidance + the model output.
 *   3. Model output only, with safe generic next steps (no treatments).
 */
import 'server-only';
import { explanationSchema, type Explanation, type ExplanationInput } from './schema';
import { getGenAiProvider } from './provider';

export type ExplanationSource = 'llm' | 'approved_guidance' | 'none';

export interface ExplanationResult {
  explanation: Explanation;
  source: ExplanationSource;
  rejectedReason?: string;
}

const pct = (score: number) => Math.round(score * 100);

// ---- guardrails -------------------------------------------------------------------------

const DOSAGE = /\d+(?:[.,]\d+)?\s*(?:ml|millilit(?:er|re)s?|g\b|gm|grams?|kg|l\b|lit(?:er|re)s?|ppm|मिली|मि\.ली|ग्राम|किलो|लीटर)/i;
const CONFIRMED = /\b(confirmed|definitely|certainly has|100%)\b|पक्का है|निश्चित रूप से|पुष्टि हो गई/i;

export function checkGuardrails(output: Explanation, input: ExplanationInput): string | null {
  if (output.language !== input.language) return 'LANGUAGE_MISMATCH';
  const text = [output.summary, output.condition_explanation, ...output.possible_causes, ...output.precautions, ...output.recommended_actions.map((a) => a.text)].join('\n');
  if (CONFIRMED.test(text)) return 'CLAIMS_CONFIRMATION';

  const approvedTreatment = (input.guidance?.approvedTreatment ?? []).join('\n');
  const dosage = text.match(DOSAGE);
  if (dosage && !approvedTreatment.includes(dosage[0].trim())) return 'UNAPPROVED_DOSAGE';

  // Percentages must be the real model score (or absent).
  for (const match of text.matchAll(/(\d{1,3})\s*%/g)) {
    const value = Number(match[1]);
    const allowed = [pct(input.score), ...input.topPredictions.map((p) => pct(p.score))];
    if (!allowed.some((a) => Math.abs(a - value) <= 1)) return 'INVENTED_SCORE';
  }

  // Without approved guidance the model may not recommend treatments or preventive regimes.
  if (!input.guidance && output.recommended_actions.some((a) => a.kind === 'prevent' || a.kind === 'test')) {
    return 'UNSUPPORTED_RECOMMENDATION';
  }
  // Sources must be the approved source (if any).
  const allowedUrl = input.guidance?.sourceUrl ?? null;
  if (output.sources.some((s) => s.url && s.url !== allowedUrl)) return 'UNKNOWN_SOURCE';
  return null;
}

// ---- deterministic (no LLM) -------------------------------------------------------------

const T = {
  hi: {
    healthy: (crop: string, s: number) =>
      `मॉडल को आपकी ${crop} की पत्ती स्वस्थ जैसी लगी (मॉडल स्कोर ${s}%). फिर भी पौधों पर नज़र रखते रहें।`,
    disease: (crop: string, c: string, s: number) =>
      `आपकी ${crop} की पत्ती की फोटो में मॉडल को "${c}" जैसे संकेत मिले (मॉडल स्कोर ${s}%). यह केवल AI जांच है — पक्की पुष्टि के लिए कृषि विशेषज्ञ से जांच कराएं।`,
    greet: (name: string) => `${name} जी, `,
    genericInspect: 'आस-पास के दूसरे पौधों की पत्तियों पर भी ऐसे ही धब्बे या बदलाव देखें।',
    genericRetake: 'दिन की रोशनी में किसी दूसरी प्रभावित पत्ती की साफ़ फोटो लेकर दोबारा जांचें।',
    genericExpert: 'कोई भी दवा या स्प्रे इस्तेमाल करने से पहले यह रिपोर्ट अपने कृषि विज्ञान केंद्र या कृषि अधिकारी को दिखाएं।',
    noGuidance: 'इस स्थिति के लिए अभी कोई विशेषज्ञ-स्वीकृत जानकारी उपलब्ध नहीं है।',
    guidanceEnglish: 'नीचे दी गई विशेषज्ञ-स्वीकृत जानकारी अंग्रेज़ी में है।',
  },
  en: {
    healthy: (crop: string, s: number) =>
      `The model sees your ${crop} leaf as healthy (model score ${s}%). Keep watching your plants.`,
    disease: (crop: string, c: string, s: number) =>
      `The model found signs similar to "${c}" in your ${crop} leaf photo (model score ${s}%). This is an AI screening only — confirm with an agriculture expert.`,
    greet: (name: string) => `${name}, `,
    genericInspect: 'Check nearby plants for similar spots or changes.',
    genericRetake: 'Take another clear photo of a different affected leaf in daylight and check again.',
    genericExpert: 'Show this report to your Krishi Vigyan Kendra or agriculture officer before using any spray or chemical.',
    noGuidance: 'No expert-approved guidance is available for this condition yet.',
    guidanceEnglish: '',
  },
};

export function buildDeterministicExplanation(input: ExplanationInput): ExplanationResult {
  const t = T[input.language];
  const score = pct(input.score);
  let summary = input.isHealthy ? t.healthy(input.cropDisplay, score) : t.disease(input.cropDisplay, input.predictedCondition, score);
  if (input.farmerName) summary = t.greet(input.farmerName) + summary.charAt(0).toLowerCase() + summary.slice(1);

  const g = input.guidance;
  const actions: Explanation['recommended_actions'] = [];
  if (g) {
    g.inspectionSteps.forEach((text) => actions.push({ kind: 'inspect', text }));
    g.prevention.forEach((text) => actions.push({ kind: 'prevent', text }));
    g.approvedTreatment.forEach((text) => actions.push({ kind: 'prevent', text }));
    g.furtherTesting.forEach((text) => actions.push({ kind: 'test', text }));
  } else {
    actions.push({ kind: 'inspect', text: t.genericInspect }, { kind: 'inspect', text: t.genericRetake });
  }
  actions.push({ kind: 'expert', text: t.genericExpert });

  const explanation = explanationSchema.parse({
    language: input.language,
    summary,
    condition_explanation: g ? [g.summary, input.language === 'hi' && t.guidanceEnglish].filter(Boolean).join(' ') : input.isHealthy ? '' : t.noGuidance,
    possible_causes: g?.causes.slice(0, 6) ?? [],
    recommended_actions: actions.slice(0, 10),
    precautions: [],
    expert_verification_required: true,
    sources: g ? [{ title: g.sourceOrganisation ?? g.title, url: g.sourceUrl }] : [],
  });
  return { explanation, source: g ? 'approved_guidance' : 'none' };
}

// ---- LLM ----------------------------------------------------------------------------------

const SYSTEM = `You explain crop-disease screening results to Indian farmers with limited reading ability.
Rules:
- The image classifier's result is given. Never change, add or guess a different disease.
- Model scores are classifier outputs, not certainty. Never say a disease is confirmed.
- Use ONLY the "approved_guidance" for causes, prevention or treatment. If it is null, give only safe
  inspection steps and advise consulting an agriculture expert. Never invent pesticide names or doses.
- Never claim weather proves disease risk; weather is context only.
- Write short, simple sentences in the requested language ("hi" = simple Hindi in Devanagari, "en" = simple English).
- Reply with JSON only, matching:
{"language":"hi|en","summary":string,"condition_explanation":string,"possible_causes":string[],
 "recommended_actions":[{"kind":"inspect|prevent|expert|test","text":string}],"precautions":string[],
 "expert_verification_required":true,"sources":[{"title":string,"url":string|null}]}`;

export async function generateExplanation(input: ExplanationInput): Promise<ExplanationResult> {
  const fallback = buildDeterministicExplanation(input);
  const provider = getGenAiProvider();
  if (!provider) return fallback;

  const payload = {
    language: input.language,
    farmer_name: input.farmerName,
    crop: input.cropDisplay,
    model: { version: input.modelVersion, predicted_condition: input.predictedCondition, is_healthy: input.isHealthy, score: input.score, top_predictions: input.topPredictions, advisories: input.advisories },
    approved_guidance: input.guidance,
    weather_context: input.weather,
  };
  try {
    const raw = await provider.complete(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      { json: true, temperature: 0.2 },
    );
    const parsed = explanationSchema.safeParse(JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim()));
    if (!parsed.success) return { ...fallback, rejectedReason: 'SCHEMA_INVALID' };
    const violation = checkGuardrails(parsed.data, input);
    if (violation) return { ...fallback, rejectedReason: violation };
    return { explanation: parsed.data, source: 'llm' };
  } catch (error) {
    return { ...fallback, rejectedReason: (error as Error).message.slice(0, 60) };
  }
}
