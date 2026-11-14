/**
 * GET /api/v1/assistant/thread?conversationId=&diagnosisId=&new=1
 *
 * The Mitra conversation to show when the assistant opens — the SAME selection the web assistant
 * page makes (app/farmer/(app)/assistant/page.tsx): the farmer's latest conversation (saved history
 * when consented, otherwise the 24-hour working copy), a specific saved one, or a fresh start.
 * Text and voice share this conversation id, so a report discussed by voice continues in text.
 */
import { getMitraConsent, listConversations, recentTurns, storedMessages } from '@/ai/conversation/mitra';
import { brand } from '@/config/brand';
import { cropName } from '@/lib/crops';
import { cleanTranscript } from '@/lib/voice/clean-transcript';
import { getCurrentFarmer } from '@/server/auth/dal';
import { db } from '@/server/db';
import { fail, ok } from '@/server/http/respond';

const ID = /^[a-z0-9]{8,40}$/i;

export async function GET(req: Request) {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const params = new URL(req.url).searchParams;
  const conversationParam = params.get('conversationId');
  const diagnosisParam = params.get('diagnosisId');
  if ((conversationParam && !ID.test(conversationParam)) || (diagnosisParam && !ID.test(diagnosisParam))) return fail('NOT_FOUND', 404, 'Not found.');
  const fresh = params.get('new') === '1';
  const lang = farmer.language === 'hi' ? 'hi' : 'en';
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 3600 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 3600 * 1000);

  const [owned, latest, consent, saved, conversation] = await Promise.all([
    diagnosisParam ? db.diagnosis.findFirst({ where: { id: diagnosisParam, farmerId: farmer.userId } }) : null,
    db.diagnosis.findFirst({ where: { farmerId: farmer.userId }, orderBy: { createdAt: 'desc' } }),
    getMitraConsent(farmer.userId),
    listConversations(farmer.userId),
    fresh
      ? null
      : db.conversation.findFirst({
          where: conversationParam
            ? { id: conversationParam, userId: farmer.userId, channel: 'mixed' }
            : { userId: farmer.userId, channel: 'mixed', OR: [{ persisted: true, lastMessageAt: { gte: monthAgo } }, { persisted: false, createdAt: { gte: dayAgo } }] },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, persisted: true, summary: true },
        }),
  ]);
  if (diagnosisParam && !owned) return fail('NOT_FOUND', 404, 'Report not found.');
  if (conversationParam && !conversation) return fail('NOT_FOUND', 404, 'Conversation not found.');

  let messages: { id: string; role: 'farmer' | 'mitra'; text: string; channel: 'voice' | 'text' }[] = [];
  if (conversation) {
    const loaded = conversation.persisted
      ? ((await storedMessages(farmer.userId, conversation.id, 40)) ?? [])
      : (await recentTurns(farmer.userId, conversation, 30)).map((t, i) => ({ id: `cached-${i}`, role: t.role, text: t.text, channel: 'text' as const }));
    messages = loaded.map((m) => (m.role === 'mitra' ? { ...m, text: cleanTranscript(m.text) } : m)).filter((m) => m.text);
  }

  const d = owned ?? latest;
  return ok({
    assistantName: brand.assistantName,
    conversationId: conversation?.id ?? null,
    persisted: conversation?.persisted ?? false,
    messages,
    report: d ? { id: d.id, focused: Boolean(owned), crop: cropName(d.predictedCrop, lang), condition: d.predictedCondition, createdAt: d.createdAt.toISOString(), isHealthy: d.isHealthy } : null,
    consent: { chatHistory: consent.chatHistory, voiceTranscripts: consent.voiceTranscripts },
    savedConversations: saved.map((c) => ({ id: c.id, title: c.title ?? null, lastMessageAt: c.lastMessageAt?.toISOString() ?? null })),
    voiceAvailable: Boolean(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY),
  });
}
