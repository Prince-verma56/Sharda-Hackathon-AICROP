/**
 * LangChain chat model for Mitra's text conversation (LangSmith traces every call when
 * LANGSMITH_TRACING=true and LANGSMITH_API_KEY are set).
 *
 *   GENAI_PROVIDER=openai-compatible  ChatOpenAI against GENAI_BASE_URL (OpenAI, Groq, Gemini's
 *                                     OpenAI endpoint, OpenRouter, Together, Ollama…) — tool calling
 *   GENAI_PROVIDER=vapi               Vapi Chat API (needs a payment method on the Vapi account) —
 *                                     plain chat; web research is done before the model call
 *   unset / none                      no model: Mitra reports "not configured" (no canned answers)
 */
import 'server-only';
import { SimpleChatModel, type BaseChatModel, type BaseChatModelParams } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

export interface MitraModel {
  model: BaseChatModel;
  provider: 'openai-compatible' | 'vapi';
  name: string;
  /** model can call LangChain tools (bindTools) */
  supportsTools: boolean;
}

function text(message: BaseMessage): string {
  return typeof message.content === 'string'
    ? message.content
    : message.content.map((part) => ('text' in part && typeof part.text === 'string' ? part.text : '')).join('');
}

/** Vapi Chat API (POST https://api.vapi.ai/chat) as a LangChain chat model. */
export class VapiChatModel extends SimpleChatModel {
  constructor(
    private readonly apiKey: string,
    private readonly modelName: string,
    private readonly temperature = 0.4,
    fields: BaseChatModelParams = {},
  ) {
    super(fields);
  }

  _llmType() {
    return 'vapi-chat';
  }

  async _call(messages: BaseMessage[]): Promise<string> {
    const system = messages.filter((m) => m.getType() === 'system').map(text).join('\n\n');
    const input = messages
      .filter((m) => m.getType() === 'human' || m.getType() === 'ai')
      .map((m) => ({ role: m.getType() === 'human' ? 'user' : 'assistant', content: text(m) }));
    const response = await fetch('https://api.vapi.ai/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assistant: { model: { provider: 'openai', model: this.modelName, temperature: this.temperature, maxTokens: 600, messages: [{ role: 'system', content: system }] } },
        input,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(`VAPI_CHAT_HTTP_${response.status}${body.message ? `: ${body.message}` : ''}`);
    }
    const data = (await response.json()) as { output?: { role?: string; content?: string }[] };
    const out = (data.output ?? []).filter((m) => m.role === 'assistant' && m.content).map((m) => m.content).join('\n').trim();
    if (!out) throw new Error('VAPI_CHAT_EMPTY');
    return out;
  }
}

export function getMitraChatModel(options: { temperature?: number; maxTokens?: number } = {}): MitraModel | null {
  const provider = (process.env.GENAI_PROVIDER || 'none').toLowerCase();
  const temperature = options.temperature ?? 0.4;

  if (provider === 'openai-compatible' || provider === 'openai') {
    const apiKey = process.env.GENAI_API_KEY;
    const model = process.env.GENAI_MODEL;
    if (!apiKey || !model) return null;
    return {
      model: new ChatOpenAI({
        model,
        apiKey,
        temperature,
        maxTokens: options.maxTokens ?? 600,
        timeout: 25_000,
        maxRetries: 1,
        configuration: { baseURL: process.env.GENAI_BASE_URL || 'https://api.openai.com/v1' },
      }),
      provider: 'openai-compatible',
      name: model,
      supportsTools: true,
    };
  }

  if (provider === 'vapi') {
    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) return null;
    const name = process.env.GENAI_MODEL || 'gpt-4o-mini';
    return { model: new VapiChatModel(apiKey, name, temperature), provider: 'vapi', name, supportsTools: false };
  }

  return null;
}

export function mitraModelStatus() {
  const m = getMitraChatModel();
  return m ? { configured: true, provider: m.provider, model: m.name, tools: m.supportsTools } : { configured: false, provider: null, model: null, tools: false };
}
