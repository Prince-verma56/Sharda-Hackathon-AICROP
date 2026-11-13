/**
 * Mitra voice assistant (Vapi). The assistant definition is built ON THE SERVER for each
 * call from authenticated context only; the browser receives a ready-made config plus a
 * signed, expiring session token. The private Vapi key never leaves the server.
 */
import 'server-only';
import { mitraGreeting, mitraInstructions, type ConversationTurn } from '@/ai/agents/mitra';
import { loadFarmerContext } from '@/ai/context/farmer-context';
import { hmac, safeEqualHex } from '@/server/auth/crypto';
import { db } from '@/server/db';
import { MITRA_TOOL_DEFINITIONS } from './mitra-tools';

export const ASSISTANT_NAME = process.env.NEXT_PUBLIC_ASSISTANT_NAME || 'Mitra';
const SESSION_TTL_SECONDS = 20 * 60;

export function signVoiceToken(voiceSessionId: string, expiresAt: number) {
  return `${voiceSessionId}.${expiresAt}.${hmac(`voice:${voiceSessionId}:${expiresAt}`)}`;
}

export function verifyVoiceToken(token: unknown): string | null {
  if (typeof token !== 'string') return null;
  const [id, exp, sig] = token.split('.');
  if (!id || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
  return safeEqualHex(hmac(`voice:${id}:${exp}`), sig) ? id : null;
}

function toolsEnabled() {
  return /^https:\/\//.test(process.env.APP_PUBLIC_URL || '') && Boolean(process.env.VAPI_WEBHOOK_SECRET);
}

export interface VoiceSessionResult {
  voiceSessionId: string;
  token: string;
  publicKey: string;
  assistantId: string | null;
  assistant: Record<string, unknown>;
  toolsEnabled: boolean;
  language: 'hi' | 'en';
}

/**
 * Creates a voice session for an authenticated farmer and returns the Vapi web-call config.
 * Uses the SAME brain as the text chat: farmer context loader, instructions, safety rules and the
 * recent visible conversation (text + voice). Only fast, local reads happen before the call.
 */
export async function createVoiceSession(
  farmerId: string,
  diagnosisId: string | null,
  history: ConversationTurn[] = [],
  options: { summary?: string | null; conversationId?: string | null } = {},
): Promise<VoiceSessionResult> {
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  if (!publicKey) throw new Error('VOICE_NOT_CONFIGURED');

  const profile = await db.farmerProfile.findUnique({ where: { userId: farmerId } });
  const language: 'hi' | 'en' = profile?.language === 'hi' ? 'hi' : 'en';
  if (diagnosisId && !(await db.diagnosis.findFirst({ where: { id: diagnosisId, farmerId }, select: { id: true } }))) {
    throw new Error('DIAGNOSIS_NOT_FOUND');
  }
  const scope = { farmerId, activeDiagnosisId: diagnosisId, language };

  const [context, conversation] = await Promise.all([
    loadFarmerContext(scope), // DB only — weather is a tool, never a start-up wait
    db.conversation.create({
      data: { userId: farmerId, channel: 'voice', metadata: { provider: 'vapi', diagnosisId, conversationId: options.conversationId ?? null, startedAt: new Date().toISOString(), audioStored: false } },
    }),
  ]);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = signVoiceToken(conversation.id, expiresAt);

  const serverUrl = `${process.env.APP_PUBLIC_URL}/api/v1/voice/tools`;
  const assistant: Record<string, unknown> = {
    name: `${ASSISTANT_NAME} (CropAI)`,
    firstMessage: mitraGreeting(language, profile?.preferredName ?? null),
    firstMessageMode: 'assistant-speaks-first',
    model: {
      provider: 'openai',
      model: process.env.VAPI_LLM_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      maxTokens: 250,
      messages: [{ role: 'system', content: mitraInstructions(context, { channel: 'voice', language, history, summary: options.summary, toolsEnabled: toolsEnabled() }) }],
      ...(toolsEnabled()
        ? {
            tools: MITRA_TOOL_DEFINITIONS.map((tool) => ({
              type: 'function',
              function: tool,
              server: { url: serverUrl, headers: { 'x-cropai-voice-secret': process.env.VAPI_WEBHOOK_SECRET } },
            })),
          }
        : {}),
    },
    voice: language === 'hi' ? { provider: 'azure', voiceId: 'hi-IN-SwaraNeural' } : { provider: 'azure', voiceId: 'en-IN-NeerjaNeural' },
    // nova-3 "multi": English + Hindi code-switching (Hinglish) in one stream.
    transcriber: { provider: 'deepgram', model: 'nova-3', language: 'multi', smartFormat: true },
    backgroundSpeechDenoisingPlan: { smartDenoisingPlan: { enabled: true } },
    clientMessages: ['transcript', 'speech-update', 'status-update', 'conversation-update', 'user-interrupted', 'assistant.speechStarted', 'model-output'],
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 45,
    // Vapi records call audio by default; CropAI promises it never records audio. Live transcripts
    // still stream to the screen (they come from the transcriber, not from a recording).
    artifactPlan: { recordingEnabled: false, videoRecordingEnabled: false },
    metadata: { cropaiVoiceToken: token },
  };

  return {
    voiceSessionId: conversation.id,
    token,
    publicKey,
    assistantId: null,
    assistant,
    toolsEnabled: toolsEnabled(),
    language,
  };
}

export async function endVoiceSession(farmerId: string, voiceSessionId: string, durationSeconds: number | null) {
  const conversation = await db.conversation.findFirst({ where: { id: voiceSessionId, userId: farmerId, channel: 'voice' } });
  if (!conversation) return false;
  const metadata = (conversation.metadata as Record<string, unknown>) ?? {};
  await db.conversation.update({
    where: { id: conversation.id },
    data: { metadata: { ...metadata, endedAt: new Date().toISOString(), durationSeconds } },
  });
  return true;
}
