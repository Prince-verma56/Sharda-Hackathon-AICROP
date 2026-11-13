/**
 * Mitra memory + agent against the real PostgreSQL / Redis (no external LLM: LangChain fake chat
 * models drive the LangGraph agent). Covers consent-gated storage, idempotent turns, isolation
 * between farmers, conversation↔diagnosis links, deletion, and the agent's tool loop + guardrails.
 */
import 'dotenv/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, type BaseMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Returns scripted AI messages in order (incl. tool calls); bindTools is a no-op. */
class ScriptedChatModel extends BaseChatModel {
  private turn = 0;
  constructor(private readonly script: AIMessage[]) {
    super({});
  }
  _llmType() {
    return 'scripted';
  }
  bindTools() {
    return this as never;
  }
  async _generate(_messages: BaseMessage[]): Promise<ChatResult> {
    const message = this.script[Math.min(this.turn++, this.script.length - 1)];
    return { generations: [{ text: typeof message.content === 'string' ? message.content : '', message }] };
  }
}

const enabled = Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite('Mitra memory and agent (integration)', () => {
  let db: typeof import('@/server/db').db;
  let mem: typeof import('@/ai/conversation/mitra');
  let agent: typeof import('@/ai/workflows/farmer-assistant');
  const tag = Date.now().toString(36);
  let farmerA: string;
  let farmerB: string;
  let diagnosisA: string;

  beforeAll(async () => {
    // warm cold imports (LangChain, redis) so per-test timings reflect a running server
    await (await import('@/server/cache/redis')).getRedis();
    ({ db } = await import('@/server/db'));
    mem = await import('@/ai/conversation/mitra');
    agent = await import('@/ai/workflows/farmer-assistant');
    farmerA = (await db.user.create({ data: { name: `mem-a-${tag}`, roles: { create: { role: 'FARMER' } }, farmerProfile: { create: { language: 'en' } } } })).id;
    farmerB = (await db.user.create({ data: { name: `mem-b-${tag}`, roles: { create: { role: 'FARMER' } }, farmerProfile: { create: { language: 'en' } } } })).id;
    diagnosisA = (
      await db.diagnosis.create({
        data: {
          farmerId: farmerA,
          selectedCrop: 'potato',
          modelName: 'test-fixture',
          modelVersion: 'test',
          modelSha256: 'test',
          predictedLabel: 'potato___early_blight',
          predictedCrop: 'potato',
          predictedCondition: 'Early blight',
          isHealthy: false,
          confidence: 0.91,
          margin: 0.5,
          scoreType: 'softmax',
          inferenceMs: 1,
          latencyMs: 1,
          qualityStatus: 'ok',
          rawOutput: {},
        },
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: [farmerA, farmerB] } } });
  });

  const stored = (conversationId: string) => db.message.count({ where: { conversationId } });

  it('without consent nothing is stored, but the 24 h working copy keeps context', async () => {
    const c = await mem.openConversation(farmerA, { language: 'en' });
    expect(c.persisted).toBe(false);
    await mem.recordTurns(farmerA, c, [
      { role: 'farmer', text: 'My potato leaves have brown rings', modality: 'text' },
      { role: 'mitra', text: 'Do you have a photo of the leaf?', modality: 'text' },
    ]);
    expect(await stored(c.id)).toBe(0);
    const turns = await mem.recentTurns(farmerA, c);
    if (process.env.REDIS_URL) expect(turns.map((t) => t.role)).toEqual(['farmer', 'mitra']);
  });

  it('stores text only with chat consent, voice transcripts only with voice consent, idempotently', async () => {
    await mem.setMitraConsent(farmerA, { chatHistory: true });
    const c = await mem.openConversation(farmerA, { language: 'en', diagnosisId: diagnosisA });
    expect(c.persisted).toBe(true);
    await mem.recordTurns(farmerA, c, [
      { role: 'farmer', text: 'What is in my report?', modality: 'text', turnId: `${tag}-1` },
      { role: 'farmer', text: 'spoken question', modality: 'voice_transcript', turnId: `${tag}-v1` },
    ]);
    expect(await stored(c.id)).toBe(1); // voice transcript not stored without voice consent
    await mem.setMitraConsent(farmerA, { voiceTranscripts: true });
    await mem.recordTurns(farmerA, c, [{ role: 'farmer', text: 'spoken question', modality: 'voice_transcript', turnId: `${tag}-v1` }]);
    await mem.recordTurns(farmerA, c, [{ role: 'farmer', text: 'spoken question', modality: 'voice_transcript', turnId: `${tag}-v1` }]); // duplicate event
    expect(await stored(c.id)).toBe(2);
    expect(await mem.linkedDiagnosisId(c.id)).toBe(diagnosisA);
    const conv = await db.conversation.findUnique({ where: { id: c.id } });
    expect(conv?.title).toBe('What is in my report?');
    expect((await mem.listConversations(farmerA)).map((x) => x.id)).toContain(c.id);
  });

  it("isolates farmers: B can neither read nor continue A's conversation", async () => {
    const [mine] = await mem.listConversations(farmerA);
    expect(await mem.storedMessages(farmerB, mine.id)).toBeNull();
    const opened = await mem.openConversation(farmerB, { conversationId: mine.id, language: 'en' });
    expect(opened.id).not.toBe(mine.id);
    expect(await mem.listConversations(farmerB)).toEqual([]);
  });

  it('withdrawing consent stops storage and deletion removes saved history', async () => {
    await mem.setMitraConsent(farmerA, { chatHistory: false, voiceTranscripts: false });
    expect(await db.conversation.count({ where: { userId: farmerA, channel: 'mixed', persisted: true } })).toBe(0);
    expect(await mem.deleteMitraHistory(farmerA)).toBeGreaterThan(0);
    expect(await db.conversation.count({ where: { userId: farmerA, channel: 'mixed' } })).toBe(0);
  });

  const scope = () => ({ farmerId: farmerA, activeDiagnosisId: diagnosisA, language: 'en' as const });

  it("without an LLM answers from the farmer's own records (labelled), never canned text", async () => {
    const saved = process.env.GENAI_PROVIDER;
    delete process.env.GENAI_PROVIDER;
    const report = await agent.askMitra('explain my latest report', scope());
    expect(report.mode).toBe('records');
    expect(report.answer).toMatch(/Early blight/);
    expect(report.answer).toMatch(/not a confirmed diagnosis/);
    const greeting = await agent.askMitra('hello', scope());
    expect(greeting.mode).toBe('guide');
    await expect(agent.askMitra('hello', scope(), [], { requireModel: true })).rejects.toBeInstanceOf(agent.MitraNotConfiguredError);
    if (saved !== undefined) process.env.GENAI_PROVIDER = saved;
  });

  it('answers through the LangGraph agent and strips chemical doses', async () => {
    const model = new FakeListChatModel({ responses: ['Your potato check shows signs like early blight. Spray 2 ml per litre of water. Remove badly affected leaves.'] });
    const answer = await agent.askMitra('what should I do now?', scope(), [{ role: 'farmer', text: 'what is in my report?' }], {
      model: { model, provider: 'vapi', name: 'fake', supportsTools: false },
    });
    expect(answer.answer).toContain('early blight');
    expect(answer.answer).not.toMatch(/2 ml/);
    expect(answer.answer).toMatch(/agriculture officer|KVK/);
    expect(answer.toolsUsed).toContain('farmer_context');
  });

  it('lets a tool-calling model read the farmer\'s own report through LangChain tools', async () => {
    const model = new ScriptedChatModel([
      new AIMessage({ content: '', tool_calls: [{ id: 'call_1', name: 'get_current_diagnosis', args: {}, type: 'tool_call' }] }),
      new AIMessage('Your latest check is potato with signs like early blight; it is not a confirmed diagnosis.'),
    ]);
    const answer = await agent.askMitra('explain my latest report', scope(), [], { model: { model, provider: 'openai-compatible', name: 'fake-tools', supportsTools: true } });
    expect(answer.toolsUsed).toContain('get_current_diagnosis');
    expect(answer.answer).toMatch(/early blight/);
  });
});
