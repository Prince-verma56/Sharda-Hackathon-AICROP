/**
 * POST /api/v1/voice/session  { conversationId?, diagnosisId? } -> Vapi web-call config for Mitra
 *   The call continues the SAME Mitra conversation as the text chat: recent turns and the rolling
 *   summary are loaded on the server (never taken from the browser).
 * POST /api/v1/voice/session  { end: voiceSessionId, durationSeconds? } -> close the call record
 */
import { z } from 'zod';
import { linkedDiagnosisId, openConversation, recentTurns } from '@/ai/conversation/mitra';
import { createVoiceSession, endVoiceSession } from '@/ai/voice/mitra';
import { getCurrentFarmer } from '@/server/auth/dal';
import { db } from '@/server/db';
import { fail, limit, ok, readJson } from '@/server/http/respond';

const schema = z.object({
  conversationId: z.string().max(40).nullable().optional(),
  diagnosisId: z.string().max(40).nullable().optional(),
  end: z.string().max(40).optional(),
  durationSeconds: z.number().int().min(0).max(7200).nullable().optional(),
});

export async function POST(req: Request) {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const body = await readJson(req, schema);
  if ('error' in body) return body.error;

  if (body.data.end) {
    const ended = await endVoiceSession(farmer.userId, body.data.end, body.data.durationSeconds ?? null);
    return ended ? ok({ ended: true }) : fail('NOT_FOUND', 404, 'Voice session not found.');
  }
  const limited = await limit(req, `voice-session:${farmer.userId}`, 10, 600);
  if (limited) return limited;

  let ownedDiagnosisId: string | null = null;
  if (body.data.diagnosisId) {
    const owned = await db.diagnosis.findFirst({ where: { id: body.data.diagnosisId, farmerId: farmer.userId }, select: { id: true } });
    if (!owned) return fail('DIAGNOSIS_NOT_FOUND', 404, 'Report not found.');
    ownedDiagnosisId = owned.id;
  }
  try {
    const language = farmer.language === 'hi' ? 'hi' : 'en';
    const conversation = await openConversation(farmer.userId, { conversationId: body.data.conversationId, language, diagnosisId: ownedDiagnosisId });
    const [history, linked] = await Promise.all([recentTurns(farmer.userId, conversation), ownedDiagnosisId ? null : linkedDiagnosisId(conversation.id)]);
    const session = await createVoiceSession(farmer.userId, ownedDiagnosisId ?? linked, history, { summary: conversation.summary, conversationId: conversation.id, focusReport: Boolean(ownedDiagnosisId) });
    return ok({ ...session, conversationId: conversation.id, persisted: conversation.persisted });
  } catch (error) {
    const code = (error as Error).message;
    if (code === 'VOICE_NOT_CONFIGURED') return fail(code, 503, 'Voice assistant is not configured.');
    if (code === 'DIAGNOSIS_NOT_FOUND') return fail(code, 404, 'Report not found.');
    console.error('[voice] session failed', code);
    return fail('VOICE_FAILED', 500, 'Could not start the voice assistant.');
  }
}
