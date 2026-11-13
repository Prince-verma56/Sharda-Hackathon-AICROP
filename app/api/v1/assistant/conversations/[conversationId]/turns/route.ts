/**
 * POST /api/v1/assistant/conversations/:id/turns  { turns: [{ role, text, turnId, modality? }] }
 * Turns from the live call: voice transcripts (default) and text the farmer typed during the call.
 * Kept in the 24 h working copy for context; stored in PostgreSQL ONLY with the matching consent
 * (voice transcripts → voice consent, typed text → chat-history consent). turnId = idempotency key.
 */
import { z } from 'zod';
import { openConversation, recordTurns } from '@/ai/conversation/mitra';
import { getCurrentFarmer } from '@/server/auth/dal';
import { db } from '@/server/db';
import { fail, limit, ok, readJson, rejectCrossSite } from '@/server/http/respond';

const schema = z.object({
  turns: z
    .array(
      z.object({
        role: z.enum(['farmer', 'mitra']),
        text: z.string().trim().min(1).max(2000),
        turnId: z.string().min(4).max(120),
        modality: z.enum(['voice_transcript', 'text']).default('voice_transcript'),
      }),
    )
    .min(1)
    .max(10),
});

export async function POST(req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const limited = await limit(req, `mitra-turns:${farmer.userId}`, 60);
  if (limited) return limited;
  const body = await readJson(req, schema);
  if ('error' in body) return body.error;
  const { conversationId } = await params;
  const owned = await db.conversation.findFirst({ where: { id: conversationId, userId: farmer.userId, channel: 'mixed' }, select: { id: true } });
  if (!owned) return fail('NOT_FOUND', 404, 'Conversation not found.');
  const conversation = await openConversation(farmer.userId, { conversationId, language: farmer.language === 'hi' ? 'hi' : 'en' });
  await recordTurns(farmer.userId, conversation, body.data.turns);
  return ok({ recorded: body.data.turns.length, persisted: conversation.persisted });
}
