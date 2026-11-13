/**
 * GenAI provider abstraction (text generation only).
 *
 * GENAI_PROVIDER=openai-compatible | vapi | none
 *   openai-compatible: GENAI_API_KEY, GENAI_MODEL, GENAI_BASE_URL (default https://api.openai.com/v1)
 *     covers OpenAI, Groq, OpenRouter, Together, Gemini's OpenAI endpoint, a local Ollama, etc.
 *   vapi: Vapi Chat API (POST https://api.vapi.ai/chat) with the private VAPI_API_KEY and
 *     GENAI_MODEL (default gpt-4o-mini) — the same model family as the Mitra voice call.
 *     Vapi requires a payment method on the account for chat.
 * TinyFish is NOT an LLM: it only supplies web search results as context (server/cropai/research.ts).
 */
import 'server-only';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenAiProvider {
  readonly name: string;
  readonly model: string;
  complete(messages: ChatMessage[], options?: { json?: boolean; temperature?: number; maxTokens?: number }): Promise<string>;
}

export class GenAiUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'GenAiUnavailableError';
  }
}

class OpenAiCompatibleProvider implements GenAiProvider {
  readonly name = 'openai-compatible';
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async complete(messages: ChatMessage[], options: { json?: boolean; temperature?: number; maxTokens?: number } = {}) {
    const response = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 900,
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new GenAiUnavailableError(`GENAI_HTTP_${response.status}`);
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new GenAiUnavailableError('GENAI_EMPTY_RESPONSE');
    return text;
  }
}

/** Vapi Chat API: system prompt as a transient assistant, the conversation as `input`. */
class VapiChatProvider implements GenAiProvider {
  readonly name = 'vapi';
  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async complete(messages: ChatMessage[], options: { json?: boolean; temperature?: number; maxTokens?: number } = {}) {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const input = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
    const response = await fetch('https://api.vapi.ai/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assistant: {
          model: {
            provider: 'openai',
            model: this.model,
            temperature: options.temperature ?? 0.3,
            maxTokens: options.maxTokens ?? 600,
            messages: [{ role: 'system', content: options.json ? `${system}\nReply with JSON only.` : system }],
          },
        },
        input,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new GenAiUnavailableError(`GENAI_HTTP_${response.status}`);
    const data = (await response.json()) as { output?: { role?: string; content?: string }[] };
    const text = (data.output ?? []).filter((m) => m.role === 'assistant' && m.content).map((m) => m.content).join('\n').trim();
    if (!text) throw new GenAiUnavailableError('GENAI_EMPTY_RESPONSE');
    return text;
  }
}

export function getGenAiProvider(): GenAiProvider | null {
  const provider = (process.env.GENAI_PROVIDER || 'none').toLowerCase();
  if (provider === 'none') return null;
  if (provider === 'vapi') {
    const vapiKey = process.env.VAPI_API_KEY;
    return vapiKey ? new VapiChatProvider(vapiKey, process.env.GENAI_MODEL || 'gpt-4o-mini') : null;
  }
  const apiKey = process.env.GENAI_API_KEY;
  const model = process.env.GENAI_MODEL;
  if (!apiKey || !model) return null;
  if (provider === 'openai-compatible' || provider === 'openai') {
    return new OpenAiCompatibleProvider(apiKey, model, process.env.GENAI_BASE_URL || 'https://api.openai.com/v1');
  }
  return null;
}

export function genAiStatus() {
  const provider = getGenAiProvider();
  return provider ? { configured: true, provider: provider.name, model: provider.model } : { configured: false, provider: null, model: null };
}
