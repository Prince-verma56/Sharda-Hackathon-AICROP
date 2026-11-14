/**
 * POST /api/v1/voice/tools — Vapi "tool-calls" server webhook.
 * 1. Vapi's credential secret (Authorization: Bearer / x-vapi-secret) must match VAPI_WEBHOOK_SECRET
 *    (constant time). It is configured in the Vapi dashboard, never sent to the browser.
 * 2. The farmer is resolved from the signed voice token we put in the assistant metadata —
 *    never from tool arguments.
 * 3. Each tool runs with that farmer's scope only.
 */
import { timingSafeEqual } from 'node:crypto';
import { runMitraTool } from '@/ai/voice/mitra-tools';
import { verifyVoiceToken } from '@/ai/voice/mitra';
import { db } from '@/server/db';

interface ToolCall {
  id: string;
  name?: string;
  arguments?: unknown;
  function?: { name: string; arguments?: unknown };
}

/**
 * The secret arrives from Vapi's servers (a Vapi credential referenced by id in the assistant
 * config), as `Authorization: Bearer <secret>` or `x-vapi-secret` — never from the browser.
 */
function secretOk(req: Request) {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected || expected.length < 24) return false;
  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
  const supplied = bearer || (req.headers.get('x-vapi-secret') ?? '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function findToken(message: Record<string, any>): unknown {
  return (
    message?.assistant?.metadata?.cropaiVoiceToken ??
    message?.call?.assistant?.metadata?.cropaiVoiceToken ??
    message?.call?.assistantOverrides?.metadata?.cropaiVoiceToken ??
    message?.call?.metadata?.cropaiVoiceToken
  );
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

export async function POST(req: Request) {
  if (!secretOk(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  let body: { message?: Record<string, any> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }
  const message = body.message ?? {};
  if (message.type !== 'tool-calls') return Response.json({});

  const calls: ToolCall[] = message.toolCallList ?? message.toolCalls ?? [];
  const sessionId = verifyVoiceToken(findToken(message));
  const conversation = sessionId
    ? await db.conversation.findFirst({ where: { id: sessionId, channel: 'voice' }, select: { userId: true, metadata: true } })
    : null;

  if (!conversation?.userId) {
    return Response.json({ results: calls.map((c) => ({ toolCallId: c.id, error: 'Session expired. Ask the farmer to restart the assistant.' })) });
  }
  const meta = (conversation.metadata as { diagnosisId?: string | null }) ?? {};
  const profile = await db.farmerProfile.findUnique({ where: { userId: conversation.userId }, select: { language: true } });
  const scope = { farmerId: conversation.userId, activeDiagnosisId: meta.diagnosisId ?? null, language: profile?.language === 'en' ? ('en' as const) : ('hi' as const) };

  const results = [];
  for (const call of calls.slice(0, 5)) {
    const name = call.function?.name ?? call.name ?? '';
    try {
      const output = await runMitraTool(name, parseArgs(call.function?.arguments ?? call.arguments), scope);
      results.push({ toolCallId: call.id, result: JSON.stringify(output) });
    } catch {
      results.push({ toolCallId: call.id, error: 'Tool failed. Continue without it.' });
    }
  }
  return Response.json({ results });
}
