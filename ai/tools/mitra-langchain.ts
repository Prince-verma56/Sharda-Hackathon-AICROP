/**
 * Mitra's LangChain tools. Every tool is bound to the authenticated farmer's scope on the
 * server — identity is never a tool argument, so the model can only read this farmer's data.
 * The same underlying functions (ai/voice/mitra-tools.ts) back the Vapi voice tools.
 */
import 'server-only';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runMitraTool, type MitraScope } from '@/ai/voice/mitra-tools';
import { researchConfigured, searchFarmingWeb, type WebSource } from '@/server/cropai/research';

export const WEB_SEARCH_TOOL = 'search_farming_web';

export function mitraTools(scope: MitraScope) {
  const json = (value: unknown) => JSON.stringify(value);
  const tools = [
    tool(async () => json(await runMitraTool('get_current_diagnosis', {}, scope)), {
      name: 'get_current_diagnosis',
      description: "The farmer's crop check being discussed (or the latest): model result, alternatives, warnings, next steps, expert review status.",
      schema: z.object({}),
    }),
    tool(async ({ limit }) => json(await runMitraTool('get_previous_diagnoses', { limit: limit ?? 5 }, scope)), {
      name: 'get_previous_diagnoses',
      description: "The farmer's recent crop checks (date, crop, condition, model score).",
      schema: z.object({ limit: z.number().int().min(1).max(10).optional().describe('How many reports (max 10)') }),
    }),
    tool(async () => json(await runMitraTool('get_local_weather', {}, scope)), {
      name: 'get_local_weather',
      description: 'Current weather and a short forecast for the farm location (context only, not disease risk).',
      schema: z.object({}),
    }),
    tool(async () => json(await runMitraTool('get_approved_crop_guidance', {}, scope)), {
      name: 'get_approved_crop_guidance',
      description: 'Expert-approved guidance for the current diagnosis condition. The ONLY allowed source for treatment / spray advice.',
      schema: z.object({}),
    }),
    tool(async () => json(await runMitraTool('request_expert_assistance', {}, scope)), {
      name: 'request_expert_assistance',
      description: 'Send the current crop check to an agriculture expert. Use ONLY when the farmer explicitly asks for an expert.',
      schema: z.object({}),
    }),
  ];
  if (researchConfigured()) {
    tools.push(
      tool(async ({ query }) => json(await searchFarmingWeb(query, { timeoutMs: 6000 })), {
        name: WEB_SEARCH_TOOL,
        description:
          'Web search (TinyFish) for current public agricultural information: government schemes, crop practices, pests, market or seasonal advice. Returns untrusted snippets with sites — cite the site; never copy doses.',
        schema: z.object({ query: z.string().min(3).max(200).describe('Short search query, include crop and "India" when relevant') }),
      }) as unknown as (typeof tools)[number],
    );
  }
  return tools;
}

/** Extracts web sources returned by the search tool (for the "Sources" list in the UI). */
export function sourcesFromToolOutput(content: unknown): WebSource[] {
  if (typeof content !== 'string') return [];
  try {
    const parsed = JSON.parse(content) as unknown;
    return Array.isArray(parsed) ? (parsed.filter((s) => s && typeof s === 'object' && 'url' in s) as WebSource[]) : [];
  } catch {
    return [];
  }
}
