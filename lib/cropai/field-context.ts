/**
 * Optional field details captured with a crop check (client-safe; shared by the scan step, the
 * upload API, the report and Mitra's context). Everything is optional — a check works without it.
 *
 *   automatic   device date/time + time zone; device location (only if the farmer allows it,
 *               rounded to ~1 km before it is stored)
 *   farmer      tap-to-choose answers (crop stage, when noticed, spread, affected parts, recent
 *               weather, recent spraying) and a short optional note
 */
import { z } from 'zod';

export const CROP_STAGES = ['seedling', 'vegetative', 'flowering', 'fruiting', 'harvest'] as const;
export const FIRST_NOTICED = ['today', 'few_days', 'week', 'weeks'] as const;
export const SPREAD = ['few_plants', 'patches', 'most_field'] as const;
export const PARTS = ['leaves', 'stem', 'fruit', 'flowers', 'roots'] as const;
export const RECENT_WEATHER = ['rain', 'dew_fog', 'hot_dry', 'normal'] as const;
export const SPRAYED = ['no', 'fungicide', 'insecticide', 'fertilizer', 'not_sure'] as const;

export const FieldContextSchema = z.object({
  capturedAt: z.string().max(40).optional(),
  timeZone: z.string().max(60).optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracyM: z.number().min(0).max(100000).optional(),
    })
    .optional(),
  cropStage: z.enum(CROP_STAGES).optional(),
  firstNoticed: z.enum(FIRST_NOTICED).optional(),
  spread: z.enum(SPREAD).optional(),
  parts: z.array(z.enum(PARTS)).max(PARTS.length).optional(),
  recentWeather: z.enum(RECENT_WEATHER).optional(),
  sprayed: z.enum(SPRAYED).optional(),
  note: z.string().trim().max(240).optional(),
});
export type FieldContext = z.infer<typeof FieldContextSchema>;

type L = { en: string; hi: string };
export const FIELD_LABELS = {
  cropStage: { en: 'Crop stage', hi: 'फसल की अवस्था' },
  firstNoticed: { en: 'First noticed', hi: 'कब से दिख रहा है' },
  spread: { en: 'How much of the field', hi: 'खेत में कितना फैला' },
  parts: { en: 'Affected parts', hi: 'कौन-सा हिस्सा' },
  recentWeather: { en: 'Recent weather', hi: 'हाल का मौसम' },
  sprayed: { en: 'Sprayed in the last 2 weeks', hi: 'पिछले 2 हफ़्ते में स्प्रे' },
  note: { en: 'Anything else (optional)', hi: 'और कुछ (वैकल्पिक)' },
} satisfies Record<string, L>;

export const FIELD_OPTIONS = {
  cropStage: {
    seedling: { en: 'Seedling', hi: 'पौध' },
    vegetative: { en: 'Growing', hi: 'बढ़वार' },
    flowering: { en: 'Flowering', hi: 'फूल' },
    fruiting: { en: 'Fruiting', hi: 'फल' },
    harvest: { en: 'Near harvest', hi: 'कटाई के पास' },
  },
  firstNoticed: {
    today: { en: 'Today', hi: 'आज' },
    few_days: { en: '2–3 days', hi: '2–3 दिन' },
    week: { en: 'About a week', hi: 'लगभग 1 हफ़्ता' },
    weeks: { en: '2+ weeks', hi: '2+ हफ़्ते' },
  },
  spread: {
    few_plants: { en: 'A few plants', hi: 'कुछ पौधे' },
    patches: { en: 'Some patches', hi: 'कुछ हिस्से' },
    most_field: { en: 'Most of the field', hi: 'ज़्यादातर खेत' },
  },
  parts: {
    leaves: { en: 'Leaves', hi: 'पत्ते' },
    stem: { en: 'Stem', hi: 'तना' },
    fruit: { en: 'Fruit', hi: 'फल' },
    flowers: { en: 'Flowers', hi: 'फूल' },
    roots: { en: 'Roots', hi: 'जड़' },
  },
  recentWeather: {
    rain: { en: 'Rain', hi: 'बारिश' },
    dew_fog: { en: 'Dew / fog', hi: 'ओस / कोहरा' },
    hot_dry: { en: 'Hot & dry', hi: 'गर्म और सूखा' },
    normal: { en: 'Normal', hi: 'सामान्य' },
  },
  sprayed: {
    no: { en: 'No', hi: 'नहीं' },
    fungicide: { en: 'Fungicide', hi: 'फफूंदनाशक' },
    insecticide: { en: 'Insecticide', hi: 'कीटनाशक' },
    fertilizer: { en: 'Fertiliser', hi: 'खाद' },
    not_sure: { en: 'Not sure', hi: 'पता नहीं' },
  },
} satisfies Record<string, Record<string, L>>;

export type ChoiceKey = keyof typeof FIELD_OPTIONS;

/** Stored form: location rounded to 2 decimals (~1 km) — enough for weather, kinder to privacy. */
export function sanitizeFieldContext(input: FieldContext): FieldContext {
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    ...input,
    location: input.location ? { latitude: round(input.location.latitude), longitude: round(input.location.longitude), accuracyM: input.location.accuracyM ? Math.round(input.location.accuracyM) : undefined } : undefined,
    note: input.note?.trim() || undefined,
  };
}

/** How many farmer answers are present (automatic date/time/location not counted). */
export function answeredCount(ctx: FieldContext | null | undefined): number {
  if (!ctx) return 0;
  return [ctx.cropStage, ctx.firstNoticed, ctx.spread, ctx.parts?.length ? ctx.parts : undefined, ctx.recentWeather, ctx.sprayed, ctx.note].filter(Boolean).length;
}

/** Plain-English facts for Mitra's context (the model reads English; it replies in the farmer's language). */
export function describeFieldContext(ctx: FieldContext | null | undefined): Record<string, string> | null {
  if (!ctx) return null;
  const pick = <K extends ChoiceKey>(key: K, value: string | undefined) => (value ? (FIELD_OPTIONS[key] as Record<string, L>)[value]?.en : undefined);
  const facts: Record<string, string | undefined> = {
    crop_stage: pick('cropStage', ctx.cropStage),
    first_noticed: pick('firstNoticed', ctx.firstNoticed),
    spread_in_field: pick('spread', ctx.spread),
    affected_parts: ctx.parts?.length ? ctx.parts.map((p) => FIELD_OPTIONS.parts[p].en).join(', ') : undefined,
    recent_weather_reported_by_farmer: pick('recentWeather', ctx.recentWeather),
    sprayed_last_2_weeks: pick('sprayed', ctx.sprayed),
    farmer_note: ctx.note,
    photo_taken_local_time: ctx.capturedAt ? `${ctx.capturedAt}${ctx.timeZone ? ` (${ctx.timeZone})` : ''}` : undefined,
  };
  const clean = Object.fromEntries(Object.entries(facts).filter(([, v]) => v)) as Record<string, string>;
  return Object.keys(clean).length ? clean : null;
}

/** The device's local date/time with its UTC offset, e.g. "2026-11-14T06:48:10+05:30", + time zone. */
export function deviceTimestamp(date = new Date()): { capturedAt: string; timeZone: string } {
  const offset = -date.getTimezoneOffset();
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const local = new Date(date.getTime() + offset * 60_000).toISOString().slice(0, 19);
  return { capturedAt: `${local}${offset >= 0 ? '+' : '-'}${pad(offset / 60)}:${pad(offset % 60)}`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}
