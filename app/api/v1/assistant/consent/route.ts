/**
 * GET  /api/v1/assistant/consent                      -> { chatHistory, voiceTranscripts, version }
 * PUT  /api/v1/assistant/consent { chatHistory?, voiceTranscripts? }   (separate, revocable choices)
 * Audio is never stored regardless of these settings.
 */
import { z } from 'zod';
import { getMitraConsent, setMitraConsent } from '@/ai/conversation/mitra';
import { auditService } from '@/server/audit';
import { getCurrentFarmer } from '@/server/auth/dal';
import { fail, ok, readJson, rejectCrossSite } from '@/server/http/respond';

const schema = z.object({ chatHistory: z.boolean().optional(), voiceTranscripts: z.boolean().optional() });

export async function GET() {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  return ok(await getMitraConsent(farmer.userId));
}

export async function PUT(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const body = await readJson(req, schema);
  if ('error' in body) return body.error;
  const consent = await setMitraConsent(farmer.userId, body.data);
  await auditService.audit({ actorId: farmer.userId, action: 'consent.mitra_updated', resource: 'farmer_profile', resourceId: farmer.userId, metadata: { ...body.data, version: consent.version } });
  return ok(consent);
}
