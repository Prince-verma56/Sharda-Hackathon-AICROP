/**
 * Farmer context for Mitra (voice and text use the same loader).
 * Server-side, ownership-scoped, minimal: no phone number, no exact GPS, no other farmers' data.
 * Weather is loaded only when asked for, so voice start-up never waits for it.
 */
import 'server-only';
import { runMitraTool, type MitraScope } from '@/ai/voice/mitra-tools';

export interface FarmerContext {
  profile: Record<string, unknown>;
  /** latest (or session) crop check, null when none */
  diagnosis: Record<string, unknown> | null;
  previous: Record<string, unknown>[];
  /** expert-approved guidance for the diagnosis condition, null when none */
  guidance: Record<string, unknown> | null;
  weather: Record<string, unknown> | null;
}

export async function loadFarmerContext(scope: MitraScope, options: { weather?: boolean } = {}): Promise<FarmerContext> {
  const [profile, diagnosis, previous, guidance, weather] = await Promise.all([
    runMitraTool('get_farmer_profile', {}, scope),
    runMitraTool('get_current_diagnosis', {}, scope),
    runMitraTool('get_previous_diagnoses', { limit: 4 }, scope),
    runMitraTool('get_approved_crop_guidance', {}, scope),
    options.weather ? runMitraTool('get_local_weather', {}, scope) : Promise.resolve(null),
  ]);
  const reports = Array.isArray(previous.reports) ? (previous.reports as Record<string, unknown>[]) : [];
  return {
    profile,
    diagnosis: 'date' in diagnosis ? diagnosis : null,
    previous: reports.slice(1),
    guidance: guidance.title ? guidance : null,
    weather: weather && weather.weather !== null ? weather : null,
  };
}
