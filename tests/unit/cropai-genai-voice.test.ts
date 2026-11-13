import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDeterministicExplanation, checkGuardrails, generateExplanation } from '@/ai/genai/explain';
import type { Explanation, ExplanationInput } from '@/ai/genai/schema';
import { signVoiceToken, verifyVoiceToken } from '@/ai/voice/mitra';
import { classifyIntent } from '@/ai/workflows/farmer-assistant';

const base: ExplanationInput = {
  language: 'en',
  crop: 'tomato',
  cropDisplay: 'Tomato',
  predictedLabel: 'tomato::Late blight',
  predictedCondition: 'Late blight',
  isHealthy: false,
  modelVersion: 'india-model-v1',
  score: 0.715,
  topPredictions: [{ label: 'tomato::Late blight', score: 0.715 }, { label: 'tomato::Early blight', score: 0.218 }],
  advisories: [],
  guidance: null,
  weather: null,
  farmerName: null,
};

const guidance = {
  title: 'Tomato late blight',
  summary: 'Caused by Phytophthora infestans.',
  symptoms: ['Water-soaked patches'],
  causes: ['Cool wet weather'],
  inspectionSteps: ['Check leaf undersides'],
  prevention: ['Remove infected leaves'],
  approvedTreatment: [],
  furtherTesting: [],
  sourceUrl: 'https://ipm.ucanr.edu/agriculture/tomato/late-blight/',
  sourceOrganisation: 'UC IPM',
};

const out = (overrides: Partial<Explanation> = {}): Explanation => ({
  language: 'en',
  summary: 'Signs similar to Late blight (model score 72%).',
  condition_explanation: '',
  possible_causes: [],
  recommended_actions: [{ kind: 'expert', text: 'Show an agriculture officer.' }],
  precautions: [],
  expert_verification_required: true,
  sources: [],
  ...overrides,
});

beforeEach(() => vi.stubEnv('AUTH_SECRET', 'test-secret-'.repeat(4)));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GenAI guardrails', () => {
  it('accepts a faithful explanation', () => expect(checkGuardrails(out(), base)).toBeNull());
  it('rejects invented doses', () => expect(checkGuardrails(out({ recommended_actions: [{ kind: 'expert', text: 'Spray 2 ml per litre.' }] }), base)).toBe('UNAPPROVED_DOSAGE'));
  it('rejects invented scores', () => expect(checkGuardrails(out({ summary: 'Model is 99% sure.' }), base)).toBe('INVENTED_SCORE'));
  it('rejects confirmation claims', () => expect(checkGuardrails(out({ summary: 'Late blight is confirmed.' }), base)).toBe('CLAIMS_CONFIRMATION'));
  it('rejects prevention advice without approved guidance', () =>
    expect(checkGuardrails(out({ recommended_actions: [{ kind: 'prevent', text: 'Rotate crops.' }] }), base)).toBe('UNSUPPORTED_RECOMMENDATION'));
  it('rejects unknown sources', () => expect(checkGuardrails(out({ sources: [{ title: 'x', url: 'https://example.com' }] }), { ...base, guidance })).toBe('UNKNOWN_SOURCE'));
  it('rejects wrong language', () => expect(checkGuardrails(out({ language: 'hi' }), base)).toBe('LANGUAGE_MISMATCH'));
});

describe('explanations', () => {
  it('without guidance gives only safe generic steps', () => {
    const r = buildDeterministicExplanation(base);
    expect(r.source).toBe('none');
    expect(r.explanation.recommended_actions.every((a) => a.kind === 'inspect' || a.kind === 'expert')).toBe(true);
    expect(r.explanation.summary).toContain('72%');
  });

  it('uses approved guidance and Hindi framing', () => {
    const r = buildDeterministicExplanation({ ...base, language: 'hi', guidance, farmerName: 'Ramesh' });
    expect(r.source).toBe('approved_guidance');
    expect(r.explanation.summary.startsWith('Ramesh जी')).toBe(true);
    expect(r.explanation.recommended_actions.some((a) => a.text === 'Remove infected leaves')).toBe(true);
    expect(r.explanation.sources[0].url).toBe(guidance.sourceUrl);
  });

  it('falls back when the LLM output violates guardrails', async () => {
    vi.stubEnv('GENAI_PROVIDER', 'openai-compatible');
    vi.stubEnv('GENAI_API_KEY', 'k');
    vi.stubEnv('GENAI_MODEL', 'm');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(out({ summary: 'Definitely late blight, 100%.' })) } }] }))));
    const r = await generateExplanation(base);
    expect(r.source).toBe('none');
    expect(r.rejectedReason).toBeTruthy();
  });

  it('accepts a valid LLM explanation', async () => {
    vi.stubEnv('GENAI_PROVIDER', 'openai-compatible');
    vi.stubEnv('GENAI_API_KEY', 'k');
    vi.stubEnv('GENAI_MODEL', 'm');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(out()) } }] }))));
    const r = await generateExplanation(base);
    expect(r.source).toBe('llm');
  });

  it('falls back when the provider is unavailable', async () => {
    vi.stubEnv('GENAI_PROVIDER', 'openai-compatible');
    vi.stubEnv('GENAI_API_KEY', 'k');
    vi.stubEnv('GENAI_MODEL', 'm');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('busy', { status: 503 })));
    const r = await generateExplanation({ ...base, guidance });
    expect(r.source).toBe('approved_guidance');
  });
});

describe('voice session tokens', () => {
  it('verifies valid tokens and rejects forged or expired ones', () => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    const token = signVoiceToken('conv123', exp);
    expect(verifyVoiceToken(token)).toBe('conv123');
    expect(verifyVoiceToken(token.replace('conv123', 'conv999'))).toBeNull();
    expect(verifyVoiceToken(signVoiceToken('conv123', Math.floor(Date.now() / 1000) - 1))).toBeNull();
    expect(verifyVoiceToken('abc.9999999999.deadbeef')).toBeNull();
    expect(verifyVoiceToken(undefined)).toBeNull();
  });
});

describe('Mitra intent routing', () => {
  it.each([
    ['meri fasal ki bimari kya hai', 'diagnosis'],
    ['ab mujhe kya karna chahiye', 'guidance'],
    ['मौसम कैसा है', 'weather'],
    ['photo kaise lu', 'photo_tips'],
    ['expert se baat karni hai', 'expert'],
    ['pichli report dikhao', 'history'],
    ['hello', 'greeting'],
    ['hello bhai', 'greeting'],
    ['yes I uploaded one earlier', 'general'],
    ['koi sarkari yojana hai kya', 'schemes'],
    ['mere tamatar ke patton par daag hai', 'diagnosis'],
  ])('%s -> %s', (text, intent) => expect(classifyIntent(text)).toBe(intent));
});

describe('voice tool webhook', () => {
  it('rejects calls without the shared secret and forged tokens', async () => {
    vi.stubEnv('VAPI_WEBHOOK_SECRET', 's'.repeat(32));
    const { POST } = await import('@/app/api/v1/voice/tools/route');
    const body = { message: { type: 'tool-calls', assistant: { metadata: { cropaiVoiceToken: 'x.9999999999.00' } }, toolCallList: [{ id: 't1', function: { name: 'get_current_diagnosis' } }] } };
    const noSecret = await POST(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }));
    expect(noSecret.status).toBe(401);
    const forged = await POST(new Request('http://x/api', { method: 'POST', headers: { 'x-cropai-voice-secret': 's'.repeat(32) }, body: JSON.stringify(body) }));
    const json = await forged.json();
    expect(json.results[0].error).toMatch(/Session expired/);
    expect(json.results[0].result).toBeUndefined();
  });
});
