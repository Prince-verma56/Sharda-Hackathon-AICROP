/**
 * Mitra text conversation — a LangGraph agent built on LangChain (LangSmith traces it when
 * LANGSMITH_TRACING / LANGSMITH_API_KEY are set):
 *
 *   understand -> load_context -> research* -> agent <-> tools -> validate
 *
 *   understand    intent (used for research gating and analytics)
 *   load_context  server-side, ownership-scoped farmer context (ai/context/farmer-context.ts)
 *   research*     TinyFish web search before the model call — only for models WITHOUT tool calling
 *   agent         LangChain chat model with Mitra's shared instructions (ai/agents/mitra.ts)
 *   tools         LangChain tools bound to this farmer (report, history, weather, approved
 *                 guidance, expert request, TinyFish web search)
 *   validate      safety guardrails (ai/guardrails/mitra.ts)
 *
 * Without a working model, answers are assembled from the farmer's own records + TinyFish web
 * search (labelled in the UI) — never canned text. Reply language/tone come from Mitra settings.
 * The voice call uses the same instructions, context loader and tool functions.
 */
import 'server-only';
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage, type ToolMessage } from '@langchain/core/messages';
import { Annotation, END, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { mitraInstructions, type ConversationTurn } from '@/ai/agents/mitra';
import { loadFarmerContext, type FarmerContext } from '@/ai/context/farmer-context';
import { enforceMitraSafety } from '@/ai/guardrails/mitra';
import { getMitraChatModel, markAutoModelUnavailable, type MitraModel } from '@/ai/models/mitra-model';
import type { MitraSettings } from '@/ai/settings/mitra-settings';
import { mitraTools, sourcesFromToolOutput, WEB_SEARCH_TOOL } from '@/ai/tools/mitra-langchain';
import type { MitraScope } from '@/ai/voice/mitra-tools';
import { researchConfigured, searchFarmingWeb, type WebSource } from '@/server/cropai/research';
import { answerFromRecordsAndWeb } from './mitra-retrieval';

export type Intent = 'greeting' | 'diagnosis' | 'guidance' | 'weather' | 'history' | 'expert' | 'photo_tips' | 'schemes' | 'general';

const RULES: [Intent, RegExp][] = [
  ['expert', /\b(send|forward|ask|connect)\b.*\b(expert|officer|specialist)\b|expert (ko|se)|विशेषज्ञ (को|से)|अधिकारी से/i],
  ['weather', /weather|rain|temperature|humid|mausam|baarish|मौसम|बारिश|तापमान/i],
  ['history', /previous|history|last time|earlier checks|pichl|पिछल|पुरान/i],
  ['photo_tips', /how (to|do i|should i) (take|click)|(photo|foto|picture) (kaise|kese|kaisi)|photo tips|camera|फोटो कैसे|तस्वीर कैसे/i],
  ['schemes', /scheme|yojana|subsid|government|sarkar|pm[- ]?kisan|insurance|\bbima\b|योजना|सरकार|सब्सिडी|बीमा(?!र)/i],
  ['guidance', /what (should|to) do|next step|prevent|treat|protect|spray|dawa|dava|upay|ilaaj|bachav|kya kar(u|un|e|na)|karna chahiye|क्या कर|करना चाहिए|दवा|उपाय|बचाव|इलाज/i],
  ['diagnosis', /disease|bimari|rog|report|result|diagnos|spots?|daag|patt(e|on)|बीमारी|रोग|रिपोर्ट|नतीजा|दाग|पत्त/i],
  ['greeting', /^(hi+|hello+|hey|namaste|namaskar|hello bhai|good (morning|evening)|नमस्ते|नमस्कार|राम राम)[\s!.,]*\w{0,8}[\s!.]*$/i],
];

export function classifyIntent(text: string): Intent {
  for (const [intent, pattern] of RULES) if (pattern.test(text.trim())) return intent;
  return 'general';
}

const RESEARCH_INTENTS: Intent[] = ['general', 'guidance', 'schemes', 'diagnosis'];

export class MitraNotConfiguredError extends Error {
  constructor() {
    super('GENAI_NOT_CONFIGURED');
    this.name = 'MitraNotConfiguredError';
  }
}

export class MitraProviderError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'MitraProviderError';
  }
}

const MitraState = Annotation.Root({
  ...MessagesAnnotation.spec,
  question: Annotation<string>(),
  intent: Annotation<Intent>(),
  context: Annotation<FarmerContext>(),
  web: Annotation<WebSource[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  toolsUsed: Annotation<string[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  answer: Annotation<string>(),
});
type S = typeof MitraState.State;

function textOf(message: BaseMessage | undefined): string {
  if (!message) return '';
  return typeof message.content === 'string'
    ? message.content
    : message.content.map((part) => ('text' in part && typeof part.text === 'string' ? part.text : '')).join('');
}

function buildMitraGraph(m: MitraModel, scope: MitraScope, summary: string | null, settings?: MitraSettings, extraInstructions?: string) {
  const tools = m.supportsTools ? mitraTools(scope) : [];
  const llm = m.supportsTools && m.model.bindTools ? m.model.bindTools(tools) : m.model;
  const toolNode = new ToolNode(tools);
  const toolHint = m.supportsTools
    ? '\n\nYou can call tools for anything not in the facts (weather, older reports, approved guidance, web search for current public information such as government schemes). Call request_expert_assistance only if the farmer explicitly asks for an expert.'
    : '';

  return new StateGraph(MitraState)
    .addNode('understand', (s: S) => ({ intent: classifyIntent(s.question) }))
    .addNode('load_context', async (s: S) => ({
      context: await loadFarmerContext(scope, { weather: s.intent === 'weather' }),
      toolsUsed: ['farmer_context'],
    }))
    .addNode('research', async (s: S) => {
      if (m.supportsTools || !RESEARCH_INTENTS.includes(s.intent) || !researchConfigured()) return {};
      const crop = typeof s.context.diagnosis?.crop === 'string' ? s.context.diagnosis.crop : null;
      const web = await searchFarmingWeb(s.question, { crop, timeoutMs: 5000 });
      return web.length ? { web, toolsUsed: ['tinyfish_search'] } : {};
    })
    .addNode('agent', async (s: S) => {
      const system = new SystemMessage(
        mitraInstructions(s.context, { channel: 'text', settings, extraInstructions, language: scope.language, web: m.supportsTools ? [] : s.web, summary }) + toolHint,
      );
      const reply = await llm.invoke([system, ...s.messages]);
      return { messages: [reply] };
    })
    .addNode('tools', async (s: S) => {
      const out = (await toolNode.invoke({ messages: s.messages })) as { messages: ToolMessage[] };
      const web = out.messages.filter((t) => t.name === WEB_SEARCH_TOOL).flatMap((t) => sourcesFromToolOutput(t.content));
      return { messages: out.messages, web, toolsUsed: out.messages.map((t) => t.name ?? 'tool') };
    })
    .addNode('validate', (s: S) => {
      const { text, removedDoses } = enforceMitraSafety(textOf(s.messages.at(-1)));
      const reply = settings?.language ?? scope.language;
      const note = reply === 'hi' ? 'दवा की मात्रा के लिए अपने कृषि अधिकारी या KVK से पूछें।' : reply === 'hinglish' ? 'Dawa ki matra ke liye apne krishi adhikari ya KVK se poochhiye.' : 'For spray doses, please ask your agriculture officer or KVK.';
      return { answer: removedDoses ? `${text} ${note}`.trim() : text };
    })
    .addEdge(START, 'understand')
    .addEdge('understand', 'load_context')
    .addEdge('load_context', 'research')
    .addEdge('research', 'agent')
    .addConditionalEdges('agent', (s: S) => ((s.messages.at(-1) as AIMessage | undefined)?.tool_calls?.length ? 'tools' : 'validate'), ['tools', 'validate'])
    .addEdge('tools', 'agent')
    .addEdge('validate', END)
    .compile();
}

export interface MitraAnswer {
  answer: string;
  intent: Intent;
  /** ai = generated by the LLM agent; records/web/guide = assembled without an LLM (labelled in the UI) */
  mode: 'ai' | 'records' | 'web' | 'guide';
  provider: string;
  model: string;
  sources: { title: string; url: string; site: string; trusted: boolean }[];
  toolsUsed: string[];
}

export async function askMitra(
  question: string,
  scope: MitraScope,
  history: ConversationTurn[] = [],
  options: { model?: MitraModel; summary?: string | null; requireModel?: boolean; settings?: MitraSettings; extraInstructions?: string } = {},
): Promise<MitraAnswer> {
  const withoutModel = async (): Promise<MitraAnswer> => {
    // No working LLM: answer from the farmer's own records + TinyFish web search (never canned text).
    const intent = classifyIntent(question);
    const context = await loadFarmerContext(scope, { weather: intent === 'weather' });
    const r = await answerFromRecordsAndWeb(question.slice(0, 500), intent, scope, context, options.settings?.language);
    return {
      answer: r.answer,
      intent,
      mode: r.mode,
      provider: 'records+tinyfish',
      model: 'none',
      sources: r.sources.slice(0, 4).map(({ title, url, site, trusted }) => ({ title, url, site, trusted })),
      toolsUsed: r.toolsUsed,
    };
  };
  const m = options.model ?? getMitraChatModel();
  if (!m) {
    if (options.requireModel) throw new MitraNotConfiguredError();
    return withoutModel();
  }
  const graph = buildMitraGraph(m, scope, options.summary ?? null, options.settings, options.extraInstructions);
  const messages: BaseMessage[] = [
    ...history.slice(-12).map((t) => (t.role === 'farmer' ? new HumanMessage(t.text.slice(0, 800)) : new AIMessage(t.text.slice(0, 800)))),
    new HumanMessage(question.slice(0, 500)),
  ];
  let result: S;
  try {
    result = (await graph.invoke(
      { messages, question: question.slice(0, 500) },
      { recursionLimit: 12, runName: 'mitra-text-assistant', tags: ['cropai', 'farmer', 'mitra'], metadata: { channel: 'text', provider: m.provider, model: m.name } },
    )) as S;
  } catch (error) {
    if (m.auto) {
      // An automatically chosen provider failed (e.g. Vapi chat needs a payment method): fall back.
      markAutoModelUnavailable();
      if (options.requireModel) throw new MitraNotConfiguredError();
      return withoutModel();
    }
    throw new MitraProviderError((error as Error).message || 'MITRA_PROVIDER_FAILED');
  }
  if (!result.answer) throw new MitraProviderError('MITRA_EMPTY_ANSWER');
  const seen = new Set<string>();
  return {
    answer: result.answer,
    intent: result.intent,
    mode: 'ai',
    provider: m.provider,
    model: m.name,
    sources: result.web
      .filter((w) => (seen.has(w.url) ? false : (seen.add(w.url), true)))
      .slice(0, 4)
      .map(({ title, url, site, trusted }) => ({ title, url, site, trusted })),
    toolsUsed: [...new Set(result.toolsUsed)],
  };
}
