/**
 * Mitra's adjustable behaviour: reply language, tone, voice, speaking pace and answer length.
 *
 *   admin defaults   platform_settings key "mitra_defaults" (+ optional extra guidance for the prompt)
 *   farmer choices   farmer_profiles.mitraSettings (partial; unset fields follow the admin default)
 *
 * Default language is Hinglish — how most Indian farmers actually speak. Safety rules always win
 * over any setting or admin guidance.
 */
import 'server-only';
import { z } from 'zod';
import { db } from '@/server/db';

export const MITRA_LANGUAGES = ['hinglish', 'hi', 'en'] as const;
export const MITRA_TONES = ['friendly', 'respectful', 'expert'] as const;
export const MITRA_VOICES = ['female', 'male'] as const;
export const MITRA_PACES = ['slow', 'normal'] as const;
export const MITRA_LENGTHS = ['short', 'detailed'] as const;

export const MitraSettingsSchema = z.object({
  language: z.enum(MITRA_LANGUAGES),
  tone: z.enum(MITRA_TONES),
  voice: z.enum(MITRA_VOICES),
  pace: z.enum(MITRA_PACES),
  length: z.enum(MITRA_LENGTHS),
});
export type MitraSettings = z.infer<typeof MitraSettingsSchema>;
export type MitraLanguage = MitraSettings['language'];

export const MitraDefaultsSchema = MitraSettingsSchema.extend({
  /** admin-written guidance added to Mitra's instructions (never overrides safety rules) */
  extraInstructions: z.string().trim().max(800).default(''),
});
export type MitraDefaults = z.infer<typeof MitraDefaultsSchema>;

export const FACTORY_DEFAULTS: MitraDefaults = { language: 'hinglish', tone: 'friendly', voice: 'female', pace: 'normal', length: 'short', extraInstructions: '' };

const DEFAULTS_KEY = 'mitra_defaults';

export async function getMitraDefaults(): Promise<MitraDefaults> {
  const row = await db.platformSetting.findUnique({ where: { key: DEFAULTS_KEY } });
  const parsed = MitraDefaultsSchema.safeParse({ ...FACTORY_DEFAULTS, ...((row?.value as object | null) ?? {}) });
  return parsed.success ? parsed.data : FACTORY_DEFAULTS;
}

export async function saveMitraDefaults(values: MitraDefaults, updatedById: string) {
  const value = MitraDefaultsSchema.parse(values);
  await db.platformSetting.upsert({ where: { key: DEFAULTS_KEY }, create: { key: DEFAULTS_KEY, value, updatedById }, update: { value, updatedById } });
}

/** The farmer's own choices (only valid fields survive). */
function farmerOverrides(raw: unknown): Partial<MitraSettings> {
  const parsed = MitraSettingsSchema.partial().safeParse(raw ?? {});
  return parsed.success ? Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) : {};
}

export interface ResolvedMitraSettings {
  effective: MitraSettings;
  overrides: Partial<MitraSettings>;
  defaults: MitraDefaults;
}

/** The farmer's saved choices. A read problem (e.g. a dev server still holding a Prisma client
 *  generated before the mitraSettings column existed) falls back to defaults instead of failing
 *  the whole page; saving still requires the current client. */
async function readFarmerChoices(farmerId: string): Promise<unknown> {
  try {
    const profile = await db.farmerProfile.findUnique({ where: { userId: farmerId }, select: { mitraSettings: true } });
    return profile?.mitraSettings ?? null;
  } catch (error) {
    console.warn('[mitra] could not read farmer settings — using defaults (restart the dev server after `prisma generate`)', (error as Error).message.split('\n')[0]);
    return null;
  }
}

export async function getMitraSettings(farmerId: string): Promise<ResolvedMitraSettings> {
  const [defaults, saved] = await Promise.all([getMitraDefaults().catch(() => FACTORY_DEFAULTS), readFarmerChoices(farmerId)]);
  const profile = { mitraSettings: saved };
  const overrides = farmerOverrides(profile?.mitraSettings);
  const { extraInstructions: _extra, ...base } = defaults;
  void _extra;
  return { effective: { ...base, ...overrides }, overrides, defaults };
}

/** Saves the farmer's choices; `null` for a field means "follow the default". */
export async function saveFarmerMitraSettings(farmerId: string, change: Partial<Record<keyof MitraSettings, string | null>>) {
  const profile = await db.farmerProfile.findUnique({ where: { userId: farmerId }, select: { mitraSettings: true } });
  const next: Record<string, string> = { ...farmerOverrides(profile?.mitraSettings) };
  for (const [key, value] of Object.entries(change)) {
    if (value === null) delete next[key];
    else if (value !== undefined) next[key] = value;
  }
  const valid = farmerOverrides(next);
  await db.farmerProfile.update({ where: { userId: farmerId }, data: { mitraSettings: valid } });
  return getMitraSettings(farmerId);
}

/** Azure neural voices that speak Indian English / Hindi (Hinglish uses the Hindi voice: it reads both scripts). */
export function voiceFor(settings: MitraSettings) {
  const hindi = settings.language !== 'en';
  const voiceId = settings.voice === 'male' ? (hindi ? 'hi-IN-MadhurNeural' : 'en-IN-PrabhatNeural') : hindi ? 'hi-IN-SwaraNeural' : 'en-IN-NeerjaNeural';
  return { provider: 'azure', voiceId, speed: settings.pace === 'slow' ? 0.9 : 1 };
}

/**
 * Speech recognition: Hindi → Deepgram's Hindi model; Hinglish and English → nova-3 "multi"
 * (English + Hindi code-switching in one stream, so mixed sentences are understood).
 */
export function transcriberFor(settings: MitraSettings) {
  return settings.language === 'hi'
    ? { provider: 'deepgram', model: 'nova-2', language: 'hi', smartFormat: true }
    : { provider: 'deepgram', model: 'nova-3', language: 'multi', smartFormat: true };
}
