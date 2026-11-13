/** Mitra settings → voice, speech recognition, greeting; transcript cleaning. */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db', () => ({ db: {} }));

const base = { language: 'hinglish', tone: 'friendly', voice: 'female', pace: 'normal', length: 'short' } as const;

describe('Mitra settings', () => {
  it('defaults to Hinglish', async () => {
    const { FACTORY_DEFAULTS } = await import('@/ai/settings/mitra-settings');
    expect(FACTORY_DEFAULTS.language).toBe('hinglish');
  });

  it('picks an Indian voice per language and gender', async () => {
    const { voiceFor } = await import('@/ai/settings/mitra-settings');
    expect(voiceFor(base).voiceId).toBe('hi-IN-SwaraNeural'); // Hinglish uses the Hindi voice
    expect(voiceFor({ ...base, voice: 'male' }).voiceId).toBe('hi-IN-MadhurNeural');
    expect(voiceFor({ ...base, language: 'en' }).voiceId).toBe('en-IN-NeerjaNeural');
    expect(voiceFor({ ...base, language: 'en', voice: 'male', pace: 'slow' })).toMatchObject({ voiceId: 'en-IN-PrabhatNeural', speed: 0.9 });
  });

  it('uses Hindi recognition for Hindi and code-switching for Hinglish/English', async () => {
    const { transcriberFor } = await import('@/ai/settings/mitra-settings');
    expect(transcriberFor({ ...base, language: 'hi' })).toMatchObject({ model: 'nova-2', language: 'hi' });
    expect(transcriberFor(base)).toMatchObject({ model: 'nova-3', language: 'multi' });
    expect(transcriberFor({ ...base, language: 'en' })).toMatchObject({ language: 'multi' });
  });

  it('greets in the chosen language', async () => {
    const { mitraGreeting } = await import('@/ai/agents/mitra');
    expect(mitraGreeting('hinglish', 'Ramesh')).toMatch(/नमस्ते Ramesh जी!.*farming assistant/);
    expect(mitraGreeting('hi', null)).toMatch(/^नमस्ते!/);
    expect(mitraGreeting('en', null)).toMatch(/^Hi!/);
  });

  it('builds instructions that always help, in the chosen language and tone', async () => {
    const { mitraInstructions } = await import('@/ai/agents/mitra');
    const context = { profile: {}, diagnosis: null, previous: [], guidance: null, weather: null } as never;
    const text = mitraInstructions(context, { channel: 'text', settings: { ...base, tone: 'respectful' }, extraInstructions: 'Mention the Noida KVK.' });
    expect(text).toMatch(/Never answer only "I cannot help"/);
    expect(text).toMatch(/Hinglish/);
    expect(text).toMatch(/"aap"\/"ji"/);
    expect(text).toMatch(/GUIDANCE FROM THE CROPAI TEAM[\s\S]*Noida KVK/);
    expect(text.indexOf('Safety rules')).toBeGreaterThan(text.indexOf('GUIDANCE FROM THE CROPAI TEAM'));
  });
});

describe('cleanTranscript', () => {
  it('drops glyphs from other scripts but keeps Hindi, English and symbols', async () => {
    const { cleanTranscript } = await import('@/lib/voice/clean-transcript');
    expect(cleanTranscript("ให้ I'm Mitra.")).toBe("I'm Mitra.");
    expect(cleanTranscript('टमाटर पर early blight, 25°C — ₹500?')).toBe('टमाटर पर early blight, 25°C — ₹500?');
  });
});
