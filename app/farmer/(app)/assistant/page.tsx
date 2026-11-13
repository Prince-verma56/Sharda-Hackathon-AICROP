import { brand } from '@/config/brand';
import { getMitraConsent, listConversations, recentTurns, storedMessages } from '@/ai/conversation/mitra';
import { cropName } from '@/lib/crops';
import { cleanTranscript } from '@/lib/voice/clean-transcript';
import { requireFarmer } from '@/server/auth/dal';
import { db } from '@/server/db';
import { MitraClient, type MitraReportContext } from './mitra-client';

export const metadata = { title: 'Mitra' };

/** A point in time `ms` ago (module-level: pages must not call Date.now during render). */
const ago = (ms: number) => new Date(Date.now() - ms);

/**
 * Mitra (voice + text, one conversation). Continues the farmer's latest conversation: saved
 * history when consented, otherwise the 24-hour working copy. `?c=` opens a saved conversation,
 * `?new=1` starts fresh, `?diagnosis=` focuses a report.
 */
export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ diagnosis?: string; c?: string; new?: string; q?: string; voice?: string }> }) {
  const farmer = await requireFarmer();
  const params = await searchParams;
  const lang = farmer.language === 'hi' ? 'hi' : 'en';
  const dayAgo = ago(24 * 3600 * 1000);
  const monthAgo = ago(30 * 24 * 3600 * 1000);

  const [owned, latest, consent, saved, conversation] = await Promise.all([
    params.diagnosis ? db.diagnosis.findFirst({ where: { id: params.diagnosis, farmerId: farmer.userId } }) : null,
    db.diagnosis.findFirst({ where: { farmerId: farmer.userId }, orderBy: { createdAt: 'desc' } }),
    getMitraConsent(farmer.userId),
    listConversations(farmer.userId),
    params.new
      ? null
      : db.conversation.findFirst({
          where: params.c
            ? { id: params.c, userId: farmer.userId, channel: 'mixed' }
            : { userId: farmer.userId, channel: 'mixed', OR: [{ persisted: true, lastMessageAt: { gte: monthAgo } }, { persisted: false, createdAt: { gte: dayAgo } }] },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, persisted: true, summary: true },
        }),
  ]);

  let initialMessages: { id: string; role: 'farmer' | 'mitra'; text: string; channel: 'voice' | 'text' }[] = [];
  if (conversation) {
    const loaded = conversation.persisted
      ? ((await storedMessages(farmer.userId, conversation.id, 40)) ?? [])
      : (await recentTurns(farmer.userId, conversation, 30)).map((t, i) => ({ id: `cached-${i}`, role: t.role, text: t.text, channel: 'text' as const }));
    // Older voice turns may hold glyphs the recogniser invented for Mitra's speech (fixed at source).
    initialMessages = loaded.map((m) => (m.role === 'mitra' ? { ...m, text: cleanTranscript(m.text) } : m)).filter((m) => m.text);
  }

  const d = owned ?? latest;
  const report: MitraReportContext | null = d
    ? {
        id: d.id,
        crop: cropName(d.predictedCrop, lang),
        condition: d.predictedCondition,
        date: d.createdAt.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        healthy: d.isHealthy,
      }
    : null;
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? null;
  return (
    <MitraClient
      lang={lang}
      diagnosisId={owned?.id ?? null}
      voiceAvailable={Boolean(publicKey)}
      publicKey={publicKey}
      assistantName={brand.assistantName}
      report={report}
      initialConversationId={conversation?.id ?? null}
      initialMessages={initialMessages}
      initialConsent={{ chatHistory: consent.chatHistory, voiceTranscripts: consent.voiceTranscripts }}
      initialQuestion={params.q ? params.q.slice(0, 300) : null}
      autoVoice={params.voice === '1' && Boolean(owned)}
      savedConversations={saved.map((c) => ({ id: c.id, title: c.title ?? '—', date: c.lastMessageAt?.toISOString() ?? '' }))}
    />
  );
}
