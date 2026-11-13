/**
 * Mitra conversations — one conversation continues across text and voice.
 *
 *   PostgreSQL  permanent record (conversations, messages, conversation_diagnoses), ONLY for what the
 *               farmer consented to store: text chat (chatHistoryConsentAt) and voice transcripts
 *               (voiceTranscriptConsentAt). Audio is never stored. System prompts are never stored.
 *   Redis       24-hour working copy of recent turns (scoped by farmer + conversation) so context
 *               works even without consent; never the only copy of anything important.
 *
 * Every function takes the authenticated farmer id and re-checks ownership.
 */
import 'server-only';
import type { ConversationTurn } from '@/ai/agents/mitra';
import { getMitraChatModel } from '@/ai/models/mitra-model';
import { db } from '@/server/db';

export const CONSENT_POLICY_VERSION = '2026-11-13';
const CACHE_TTL_SECONDS = 24 * 3600;
const CACHE_MAX_TURNS = 40;
const SUMMARISE_AFTER = 24;

export interface MitraConsent {
  chatHistory: boolean;
  voiceTranscripts: boolean;
  version: string | null;
}

export interface MitraConversation {
  id: string;
  persisted: boolean;
  summary: string | null;
}

export interface TurnInput {
  role: 'farmer' | 'mitra';
  text: string;
  modality: 'text' | 'voice_transcript';
  turnId?: string;
  status?: 'complete' | 'failed' | 'interrupted';
  provider?: string;
  model?: string;
}

// ---- consent ---------------------------------------------------------------------------------

export async function getMitraConsent(farmerId: string): Promise<MitraConsent> {
  const p = await db.farmerProfile.findUnique({
    where: { userId: farmerId },
    select: { chatHistoryConsentAt: true, voiceTranscriptConsentAt: true, consentPolicyVersion: true },
  });
  return { chatHistory: Boolean(p?.chatHistoryConsentAt), voiceTranscripts: Boolean(p?.voiceTranscriptConsentAt), version: p?.consentPolicyVersion ?? null };
}

export async function setMitraConsent(farmerId: string, change: { chatHistory?: boolean; voiceTranscripts?: boolean }): Promise<MitraConsent> {
  const now = new Date();
  await db.farmerProfile.update({
    where: { userId: farmerId },
    data: {
      ...(change.chatHistory === undefined ? {} : { chatHistoryConsentAt: change.chatHistory ? now : null }),
      ...(change.voiceTranscripts === undefined ? {} : { voiceTranscriptConsentAt: change.voiceTranscripts ? now : null }),
      consentPolicyVersion: CONSENT_POLICY_VERSION,
    },
  });
  // Withdrawing chat-history consent stops storage for open conversations immediately.
  if (change.chatHistory === false) {
    await db.conversation.updateMany({ where: { userId: farmerId, channel: 'mixed' }, data: { persisted: false } });
  }
  return getMitraConsent(farmerId);
}

/** "Delete my Mitra history": all stored conversations/messages and cached turns of this farmer. */
export async function deleteMitraHistory(farmerId: string): Promise<number> {
  const conversations = await db.conversation.findMany({ where: { userId: farmerId, channel: 'mixed' }, select: { id: true } });
  await db.conversation.deleteMany({ where: { userId: farmerId, channel: 'mixed' } });
  const redis = await cache();
  if (redis && conversations.length) await redis.del(conversations.map((c) => cacheKey(farmerId, c.id))).catch(() => undefined);
  return conversations.length;
}

// ---- conversations ---------------------------------------------------------------------------

/** The farmer's conversation (owned), or a new one. Links the discussed report when given. */
export async function openConversation(
  farmerId: string,
  options: { conversationId?: string | null; language: 'hi' | 'en'; diagnosisId?: string | null },
): Promise<MitraConversation> {
  const consent = await getMitraConsent(farmerId);
  let conversation = options.conversationId
    ? await db.conversation.findFirst({ where: { id: options.conversationId, userId: farmerId, channel: 'mixed' }, select: { id: true, persisted: true, summary: true } })
    : null;
  if (!conversation) {
    conversation = await db.conversation.create({
      data: { userId: farmerId, channel: 'mixed', language: options.language, persisted: consent.chatHistory || consent.voiceTranscripts },
      select: { id: true, persisted: true, summary: true },
    });
  } else if (!conversation.persisted && (consent.chatHistory || consent.voiceTranscripts)) {
    conversation = await db.conversation.update({ where: { id: conversation.id }, data: { persisted: true }, select: { id: true, persisted: true, summary: true } });
  }
  if (options.diagnosisId) {
    await db.conversationDiagnosis.upsert({
      where: { conversationId_diagnosisId: { conversationId: conversation.id, diagnosisId: options.diagnosisId } },
      create: { conversationId: conversation.id, diagnosisId: options.diagnosisId },
      update: {},
    });
  }
  return conversation;
}

/** Most recent report linked to this conversation (the verified relationship for "my report"). */
export async function linkedDiagnosisId(conversationId: string): Promise<string | null> {
  const link = await db.conversationDiagnosis.findFirst({ where: { conversationId }, orderBy: { createdAt: 'desc' }, select: { diagnosisId: true } });
  return link?.diagnosisId ?? null;
}

export async function listConversations(farmerId: string, take = 10) {
  return db.conversation.findMany({
    where: { userId: farmerId, channel: 'mixed', persisted: true, lastMessageAt: { not: null } },
    orderBy: { lastMessageAt: 'desc' },
    take,
    select: { id: true, title: true, lastMessageAt: true },
  });
}

/** Stored messages of an owned conversation (for reopening it), oldest first. */
export async function storedMessages(farmerId: string, conversationId: string, take = 50) {
  const conversation = await db.conversation.findFirst({ where: { id: conversationId, userId: farmerId, channel: 'mixed' }, select: { id: true } });
  if (!conversation) return null;
  const rows = await db.message.findMany({
    where: { conversationId, role: { in: ['user', 'assistant'] }, status: 'complete' },
    orderBy: { sequence: 'desc' },
    take,
    select: { id: true, role: true, content: true, modality: true, createdAt: true },
  });
  return rows.reverse().map((m) => ({ id: m.id, role: m.role === 'user' ? ('farmer' as const) : ('mitra' as const), text: m.content, channel: m.modality === 'voice_transcript' ? ('voice' as const) : ('text' as const) }));
}

// ---- turns -------------------------------------------------------------------------------------

async function cache() {
  try {
    const { getRedis } = await import('@/server/cache/redis');
    return await getRedis();
  } catch {
    return null;
  }
}

const cacheKey = (farmerId: string, conversationId: string) => `mitra:turns:${farmerId}:${conversationId}`;

/** Recent turns for the model: Redis working copy first, else stored messages. */
export async function recentTurns(farmerId: string, conversation: MitraConversation, limit = 12): Promise<ConversationTurn[]> {
  const redis = await cache();
  if (redis) {
    const raw = await redis.lRange(cacheKey(farmerId, conversation.id), -limit, -1).catch(() => [] as string[]);
    if (raw.length) return raw.map((r) => JSON.parse(r) as ConversationTurn);
  }
  if (!conversation.persisted) return [];
  const stored = await storedMessages(farmerId, conversation.id, limit);
  return (stored ?? []).map(({ role, text }) => ({ role, text }));
}

/**
 * Records turns: always in the Redis working copy; in PostgreSQL only when consented for that
 * modality. turnId makes repeated deliveries (e.g. duplicate voice events) idempotent.
 */
export async function recordTurns(farmerId: string, conversation: MitraConversation, turns: TurnInput[]): Promise<void> {
  const clean = turns.filter((t) => t.text.trim());
  if (!clean.length) return;

  const redis = await cache();
  const cacheable = clean.filter((t) => t.status !== 'failed').map((t) => JSON.stringify({ role: t.role, text: t.text.slice(0, 1200) }));
  if (redis && cacheable.length) {
    const key = cacheKey(farmerId, conversation.id);
    await redis
      .multi()
      .rPush(key, cacheable)
      .lTrim(key, -CACHE_MAX_TURNS, -1)
      .expire(key, CACHE_TTL_SECONDS)
      .exec()
      .catch(() => undefined);
  }

  if (!conversation.persisted) return;
  const consent = await getMitraConsent(farmerId);
  const allowed = clean.filter((t) => (t.modality === 'text' ? consent.chatHistory : consent.voiceTranscripts));
  if (!allowed.length) return;

  await db.$transaction(async (tx) => {
    const last = await tx.message.findFirst({ where: { conversationId: conversation.id }, orderBy: { sequence: 'desc' }, select: { sequence: true } });
    let sequence = last?.sequence ?? 0;
    await tx.message.createMany({
      data: allowed.map((t) => ({
        conversationId: conversation.id,
        role: t.role === 'farmer' ? 'user' : 'assistant',
        content: t.text.slice(0, 4000),
        modality: t.modality,
        status: t.status ?? 'complete',
        provider: t.provider ?? null,
        model: t.model ?? null,
        turnId: t.turnId ?? null,
        sequence: (sequence += 1),
      })),
      skipDuplicates: true,
    });
    const firstFarmer = allowed.find((t) => t.role === 'farmer');
    const current = await tx.conversation.findUnique({ where: { id: conversation.id }, select: { title: true } });
    await tx.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), ...(!current?.title && firstFarmer ? { title: firstFarmer.text.slice(0, 80) } : {}) },
    });
  });
}

/**
 * Rolling summary of older stored turns (when an LLM is configured). Keeps the context window
 * bounded for long conversations; never replaces the diagnosis records themselves.
 */
export async function maybeSummarise(farmerId: string, conversationId: string): Promise<void> {
  const conversation = await db.conversation.findFirst({ where: { id: conversationId, userId: farmerId, persisted: true }, select: { summary: true, summaryVersion: true, summarizedMessageId: true } });
  if (!conversation) return;
  const after = conversation.summarizedMessageId
    ? await db.message.findUnique({ where: { id: conversation.summarizedMessageId }, select: { sequence: true } })
    : null;
  const pending = await db.message.findMany({
    where: { conversationId, sequence: { gt: after?.sequence ?? 0 }, status: 'complete' },
    orderBy: { sequence: 'asc' },
    select: { id: true, role: true, content: true },
  });
  if (pending.length < SUMMARISE_AFTER) return;
  const model = getMitraChatModel({ temperature: 0.1, maxTokens: 300 });
  if (!model) return;
  const older = pending.slice(0, pending.length - 8); // keep the latest turns verbatim
  const transcript = older.map((m) => `${m.role === 'user' ? 'Farmer' : 'Mitra'}: ${m.content}`).join('\n');
  const reply = await model.model.invoke([
    ['system', 'Summarise this farming conversation for future context in at most 8 short bullet points: crops, problems, reports referred to, advice already given, open questions. No personal details (no names, phone numbers, places smaller than district).'],
    ['human', `${conversation.summary ? `Previous summary:\n${conversation.summary}\n\n` : ''}New messages:\n${transcript}`],
  ]);
  const text = typeof reply.content === 'string' ? reply.content : '';
  if (!text.trim()) return;
  await db.conversation.update({
    where: { id: conversationId },
    data: { summary: text.trim().slice(0, 2000), summaryVersion: conversation.summaryVersion + 1, summarizedMessageId: older.at(-1)!.id },
  });
}
