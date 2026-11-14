/**
 * GET /api/v1/assistant/settings   the signed-in farmer's Mitra settings (effective + own choices + defaults)
 * PUT /api/v1/assistant/settings   { language?, tone?, voice?, pace?, length? } — null = follow the default
 * Takes effect on the next message / the next voice call.
 */
import { z } from 'zod';
import { getMitraSettings, MITRA_LANGUAGES, MITRA_LENGTHS, MITRA_PACES, MITRA_TONES, MITRA_VOICES, saveFarmerMitraSettings, type ResolvedMitraSettings } from '@/ai/settings/mitra-settings';
import { MITRA_SETTING_GROUPS } from '@/lib/mitra/settings-options';
import { getCurrentFarmer } from '@/server/auth/dal';
import { fail, limit, ok, readJson, rejectCrossSite } from '@/server/http/respond';

const schema = z.object({
  language: z.enum(MITRA_LANGUAGES).nullable().optional(),
  tone: z.enum(MITRA_TONES).nullable().optional(),
  voice: z.enum(MITRA_VOICES).nullable().optional(),
  pace: z.enum(MITRA_PACES).nullable().optional(),
  length: z.enum(MITRA_LENGTHS).nullable().optional(),
});

/** Admin guidance text is internal: farmers only see the default choices. */
function present(s: ResolvedMitraSettings) {
  const { extraInstructions: _extra, ...defaults } = s.defaults;
  void _extra;
  // `options`: the labels/hints for each choice in English + Hindi (used by the mobile app).
  return { effective: s.effective, overrides: s.overrides, defaults, options: MITRA_SETTING_GROUPS };
}

export async function GET() {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  return ok(present(await getMitraSettings(farmer.userId)));
}

export async function PUT(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const limited = await limit(req, `mitra-settings:${farmer.userId}`, 30);
  if (limited) return limited;
  const body = await readJson(req, schema);
  if ('error' in body) return body.error;
  return ok(present(await saveFarmerMitraSettings(farmer.userId, body.data)));
}
