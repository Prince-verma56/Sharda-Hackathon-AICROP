/**
 * Source discovery for the knowledge base via TinyFish (web search + fetch; NOT an LLM).
 * Results only help experts draft entries — they are never shown to farmers until an
 * authorised expert writes, reviews and approves a KnowledgeEntry.
 *   Search: GET https://api.search.tinyfish.ai?query=…   (X-API-Key)
 *   Fetch:  POST https://api.fetch.tinyfish.ai {urls, format}
 */
import 'server-only';
import { z } from 'zod';

const searchSchema = z.object({
  results: z.array(z.object({ title: z.string().optional(), url: z.string(), snippet: z.string().optional(), site_name: z.string().optional(), date: z.string().optional() })).default([]),
});
const fetchSchema = z.object({
  results: z.array(z.object({ url: z.string(), final_url: z.string().optional(), title: z.string().nullable().optional(), text: z.unknown() })).default([]),
  errors: z.array(z.unknown()).default([]),
});

export function researchConfigured() {
  return Boolean(process.env.TINYFISH_API_KEY);
}

function key() {
  const value = process.env.TINYFISH_API_KEY;
  if (!value) throw new Error('RESEARCH_NOT_CONFIGURED');
  return value;
}

/** Prefer Indian public agricultural institutions when ranking. */
const TRUSTED = /(icar\.(org|gov)\.in|agritech\.tnau\.ac\.in|tnau\.ac\.in|ppqs\.gov\.in|agricoop\.nic\.in|farmer\.gov\.in|kvk|\.gov\.in|\.ac\.in|\.edu|ipm\.ucanr\.edu|fao\.org|cabi\.org|apsnet\.org)/i;

export async function searchSources(crop: string, condition: string) {
  const query = `${crop} ${condition} disease symptoms management India`;
  const url = `https://api.search.tinyfish.ai?${new URLSearchParams({ query })}`;
  const response = await fetch(url, { headers: { 'X-API-Key': key() }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`RESEARCH_HTTP_${response.status}`);
  const data = searchSchema.parse(await response.json());
  return data.results
    .map((r) => ({ title: r.title ?? r.url, url: r.url, snippet: r.snippet ?? '', site: r.site_name ?? new URL(r.url).hostname, trusted: TRUSTED.test(r.url) }))
    .sort((a, b) => Number(b.trusted) - Number(a.trusted))
    .slice(0, 8);
}

export async function fetchSourceExcerpt(sourceUrl: string) {
  if (!/^https:\/\//.test(sourceUrl)) throw new Error('RESEARCH_URL_INVALID');
  const response = await fetch('https://api.fetch.tinyfish.ai', {
    method: 'POST',
    headers: { 'X-API-Key': key(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: [sourceUrl], format: 'markdown', purpose: 'Draft a crop disease knowledge entry for expert review' }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`RESEARCH_HTTP_${response.status}`);
  const data = fetchSchema.parse(await response.json());
  const first = data.results[0];
  if (!first || typeof first.text !== 'string') throw new Error('RESEARCH_FETCH_FAILED');
  return { url: first.final_url ?? first.url, title: first.title ?? null, excerpt: first.text.slice(0, 4000) };
}

// ---- farmer-facing web context (Mitra) --------------------------------------------------------

/** Social media, video and shopping pages are never used as farming sources. */
const BLOCKED = /(youtube\.com|youtu\.be|facebook\.com|instagram\.com|reddit\.com|quora\.com|pinterest\.|tiktok\.com|twitter\.com|\/\/x\.com|amazon\.|flipkart\.|indiamart\.)/i;
/** Sentences with chemical doses are dropped: CropAI never passes on unreviewed spray doses. */
export const DOSE_PATTERN = /\d+(?:[.,]\d+)?\s*(ml|g\b|gm|gram|kg|litre|liter|l\/ha|kg\/ha|g\/l|ml\/l|ppm|मिली|ग्राम|लीटर|किलो)/i;

export interface WebSource {
  title: string;
  url: string;
  site: string;
  snippet: string;
  trusted: boolean;
}

/** Strips dose-bearing sentences from a snippet. */
export function withoutDoses(text: string): string {
  return text
    .split(/(?<=[.!?।])\s+/)
    .filter((sentence) => !DOSE_PATTERN.test(sentence))
    .join(' ')
    .trim();
}

/**
 * TinyFish web search for a farmer's question: trusted public/academic sources first, at most 4
 * results, short timeout (returns [] on any failure — the assistant then answers without it).
 */
export async function searchFarmingWeb(question: string, options: { crop?: string | null; timeoutMs?: number } = {}): Promise<WebSource[]> {
  if (!researchConfigured()) return [];
  const query = `${options.crop ? `${options.crop} ` : ''}${question} farming India`.slice(0, 200);
  try {
    const response = await fetch(`https://api.search.tinyfish.ai?${new URLSearchParams({ query })}`, {
      headers: { 'X-API-Key': key() },
      signal: AbortSignal.timeout(options.timeoutMs ?? 6000),
    });
    if (!response.ok) return [];
    const data = searchSchema.parse(await response.json());
    return data.results
      .filter((r) => /^https:\/\//.test(r.url) && !BLOCKED.test(r.url))
      .map((r) => ({
        title: (r.title ?? r.url).slice(0, 140),
        url: r.url,
        site: r.site_name ?? new URL(r.url).hostname,
        snippet: withoutDoses((r.snippet ?? '').replace(/\s+/g, ' ').trim()).slice(0, 400),
        trusted: TRUSTED.test(r.url),
      }))
      .filter((r) => r.snippet.length > 30)
      .sort((a, b) => Number(b.trusted) - Number(a.trusted))
      .slice(0, 4);
  } catch {
    return [];
  }
}
