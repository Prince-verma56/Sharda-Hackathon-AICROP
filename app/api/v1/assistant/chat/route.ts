/**
 * POST /api/v1/assistant/chat  (alias: /api/v1/ai/chat)
 *   { message, conversationId?, diagnosisId?, turnId? }
 *
 * Mitra text conversation — same LangGraph brain, farmer context and safety rules as the voice
 * call. History comes from the server (Redis working copy / PostgreSQL when the farmer consented),
 * never from the browser. Without a configured LLM: 503 GENAI_NOT_CONFIGURED (no canned answers).
 */
import { z } from 'zod';
import { linkedDiagnosisId, maybeSummarise, openConversation, recentTurns, recordTurns } from '@/ai/conversation/mitra';
import { MitraNotConfiguredError, MitraProviderError, askMitra } from '@/ai/workflows/farmer-assistant';
import { getCurrentFarmer } from '@/server/auth/dal';
import { db } from '@/server/db';
import { fail, limit, ok, readJson } from '@/server/http/respond';

const schema = z.object({
  message: z.string().trim().min(1).max(500),
  conversationId: z.string().max(40).nullable().optional(),
  diagnosisId: z.string().max(40).nullable().optional(),
  turnId: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const limited = await limit(req, `assistant:${farmer.userId}`, 20);
  if (limited) return limited;
  const body = await readJson(req, schema);
  if ('error' in body) return body.error;

  let ownedDiagnosisId: string | null = null;
  if (body.data.diagnosisId) {
    const owned = await db.diagnosis.findFirst({ where: { id: body.data.diagnosisId, farmerId: farmer.userId }, select: { id: true } });
    if (!owned) return fail('NOT_FOUND', 404, 'Report not found.');
    ownedDiagnosisId = owned.id;
  }
  const language = farmer.language === 'hi' ? 'hi' : 'en';
  const conversation = await openConversation(farmer.userId, { conversationId: body.data.conversationId, language, diagnosisId: ownedDiagnosisId });
  const activeDiagnosisId = ownedDiagnosisId ?? (await linkedDiagnosisId(conversation.id));
  const history = await recentTurns(farmer.userId, conversation);
  const farmerTurn = { role: 'farmer' as const, text: body.data.message, modality: 'text' as const, turnId: body.data.turnId };

  try {
    const result = await askMitra(body.data.message, { farmerId: farmer.userId, activeDiagnosisId, language }, history, { summary: conversation.summary });
    await recordTurns(farmer.userId, conversation, [
      farmerTurn,
      { role: 'mitra', text: result.answer, modality: 'text', provider: result.provider, model: result.model, turnId: body.data.turnId ? `${body.data.turnId}:a` : undefined },
    ]);
    void maybeSummarise(farmer.userId, conversation.id).catch(() => undefined);
    return ok({ conversationId: conversation.id, persisted: conversation.persisted, ...result });
  } catch (error) {
    // Keep the farmer's own message (where consented); no fabricated answer is stored.
    await recordTurns(farmer.userId, conversation, [farmerTurn]).catch(() => undefined);
    if (error instanceof MitraNotConfiguredError) {
      return fail('GENAI_NOT_CONFIGURED', 503, 'Mitra’s AI model is not configured yet. Set GENAI_PROVIDER (vapi or openai-compatible) on the server.', { conversationId: conversation.id });
    }
    if (error instanceof MitraProviderError) {
      console.error('[mitra] provider error', error.message);
      return fail('GENAI_UNAVAILABLE', 502, 'Mitra’s AI model did not answer. Please try again.', { conversationId: conversation.id });
    }
    console.error('[mitra] chat failed', (error as Error).message);
    return fail('MITRA_FAILED', 500, 'Mitra could not answer right now. Please try again.', { conversationId: conversation.id });
  }
}
