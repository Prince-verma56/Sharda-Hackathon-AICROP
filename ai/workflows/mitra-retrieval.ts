/**
 * Mitra answers WITHOUT a language model (used until GENAI_PROVIDER is configured).
 *
 * Not canned replies: every answer is assembled from real data —
 *   records  the signed-in farmer's own report, next steps, expert-approved guidance, weather,
 *            past checks (same context loader as the LLM path and the voice call)
 *   web      TinyFish web search: the most relevant sentences from trusted sources, with links
 * Answers are labelled by source in the UI. With an LLM configured, the LangGraph agent is used.
 */
import 'server-only';
import type { FarmerContext } from '@/ai/context/farmer-context';
import { runMitraTool, type MitraScope } from '@/ai/voice/mitra-tools';
import { researchConfigured, searchFarmingWeb, withoutDoses, type WebSource } from '@/server/cropai/research';
import type { Intent } from './farmer-assistant';

export interface RetrievalAnswer {
  answer: string;
  mode: 'records' | 'web' | 'guide';
  sources: WebSource[];
  toolsUsed: string[];
}

type Lang = 'hi' | 'en';
const T = {
  en: {
    hello: (name: string | null) =>
      `Hello${name ? ` ${name}` : ''}! I’m Mitra. I can explain your crop report, tell you what to do next, show your past checks and local weather, or look up farming information and government schemes. What would you like to know?`,
    noReport: 'You don’t have a crop check yet. Tap “Check my crop” and take a clear photo of one affected leaf — then I can explain the result.',
    report: (d: Record<string, unknown>) =>
      `Your ${d.crop} check on ${d.date}: the AI model suggests ${d.predicted_condition} (model score ${d.model_score}). This is a screening result, not a confirmed diagnosis.`,
    alternatives: (a: string[]) => `Other possibilities the model considered: ${a.join(', ')}.`,
    review: (s: string) => (s === 'CONFIRMED' ? 'An expert has confirmed this result.' : s === 'PENDING' ? 'An expert review has been requested.' : ''),
    steps: 'What to do next:',
    approved: (src: string) => `Expert-approved guidance (${src}):`,
    noGuidance: 'There is no expert-approved treatment for this condition in CropAI yet. Please ask your agriculture officer or Krishi Vigyan Kendra (KVK) before using any chemical.',
    weather: (w: Record<string, unknown>) =>
      `Weather at your farm now: ${w.temperature_c ?? '—'}°C, humidity ${w.humidity_pct ?? '—'}%, rain in the last 24 hours ${w.rain_last_24h_mm ?? '—'} mm. This is weather context only, not a disease forecast.`,
    noWeather: 'Add your farm location in your profile and I can show the local weather.',
    history: (n: number) => `Your last ${n} crop checks:`,
    noHistory: 'You have no earlier crop checks yet.',
    tips: 'For a good photo: use daylight, take one affected leaf up close, fill the screen with the leaf and hold steady so it is not blurry.',
    expert: 'Done — I have sent your latest report to an agriculture expert. You will be notified when they reply.',
    expertNone: 'Please do a crop check first, so an expert has a report to review.',
    found: 'Here is what I found from trusted sources:',
    confirm: 'Please confirm with your agriculture officer, KVK or the official website before acting.',
    nothing: 'I couldn’t find reliable information on that right now. You can ask me about your crop report or weather, or call the Kisan Call Centre at 1800-180-1551 (free).',
  },
  hi: {
    hello: (name: string | null) =>
      `नमस्ते${name ? ` ${name} जी` : ''}! मैं मित्र हूँ। मैं आपकी फसल रिपोर्ट समझा सकता हूँ, आगे क्या करना है बता सकता हूँ, पिछली जाँच और मौसम दिखा सकता हूँ, या खेती और सरकारी योजनाओं की जानकारी ढूँढ सकता हूँ। आप क्या जानना चाहेंगे?`,
    noReport: 'अभी आपकी कोई फसल जाँच नहीं है। “फसल जांचें” दबाकर एक प्रभावित पत्ती की साफ़ फोटो लें — फिर मैं नतीजा समझाऊँगा।',
    report: (d: Record<string, unknown>) =>
      `${d.date} को आपकी ${d.crop} की जाँच में AI मॉडल ने “${d.predicted_condition}” जैसे संकेत पाए (मॉडल स्कोर ${d.model_score})। यह स्क्रीनिंग है, पक्की पुष्टि नहीं।`,
    alternatives: (a: string[]) => `मॉडल ने ये संभावनाएँ भी देखीं: ${a.join(', ')}।`,
    review: (s: string) => (s === 'CONFIRMED' ? 'विशेषज्ञ ने इस नतीजे की पुष्टि की है।' : s === 'PENDING' ? 'विशेषज्ञ से जाँच का अनुरोध भेजा गया है।' : ''),
    steps: 'आगे क्या करें:',
    approved: (src: string) => `विशेषज्ञ-स्वीकृत सलाह (${src}):`,
    noGuidance: 'इस स्थिति के लिए CropAI में अभी विशेषज्ञ-स्वीकृत उपचार नहीं है। कोई भी दवा इस्तेमाल करने से पहले अपने कृषि अधिकारी या कृषि विज्ञान केंद्र (KVK) से पूछें।',
    weather: (w: Record<string, unknown>) =>
      `आपके खेत पर अभी मौसम: ${w.temperature_c ?? '—'}°C, नमी ${w.humidity_pct ?? '—'}%, पिछले 24 घंटे में बारिश ${w.rain_last_24h_mm ?? '—'} मिमी। यह सिर्फ़ मौसम की जानकारी है, बीमारी का अनुमान नहीं।`,
    noWeather: 'प्रोफ़ाइल में अपने खेत की जगह जोड़ें, फिर मैं स्थानीय मौसम बता पाऊँगा।',
    history: (n: number) => `आपकी पिछली ${n} फसल जाँच:`,
    noHistory: 'अभी आपकी कोई पिछली जाँच नहीं है।',
    tips: 'अच्छी फोटो के लिए: दिन की रोशनी में, एक प्रभावित पत्ती पास से लें, पत्ती से पूरी स्क्रीन भरें और फोन स्थिर रखें ताकि फोटो धुंधली न हो।',
    expert: 'हो गया — मैंने आपकी आखिरी रिपोर्ट कृषि विशेषज्ञ को भेज दी है। जवाब आने पर आपको सूचना मिलेगी।',
    expertNone: 'पहले एक फसल जाँच करें, ताकि विशेषज्ञ के पास देखने के लिए रिपोर्ट हो।',
    found: 'भरोसेमंद स्रोतों से मुझे यह जानकारी मिली:',
    confirm: 'कुछ भी करने से पहले अपने कृषि अधिकारी, KVK या आधिकारिक वेबसाइट से पुष्टि कर लें।',
    nothing: 'अभी मुझे इस पर भरोसेमंद जानकारी नहीं मिली। आप अपनी फसल रिपोर्ट या मौसम के बारे में पूछ सकते हैं, या किसान कॉल सेंटर 1800-180-1551 (मुफ़्त) पर कॉल करें।',
  },
};

const list = (items: unknown[], max = 5) =>
  items
    .filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
    .slice(0, max)
    .map((i) => `• ${withoutDoses(i)}`)
    .filter((i) => i.length > 2)
    .join('\n');

/** Picks the snippet sentences that share the most words with the question. */
function bestSentences(question: string, sources: WebSource[], max = 3): { text: string; site: string }[] {
  const words = new Set(question.toLowerCase().split(/[^a-zऀ-ॿ0-9]+/).filter((w) => w.length > 3));
  const scored: { text: string; site: string; score: number }[] = [];
  for (const s of sources) {
    for (const sentence of s.snippet.split(/(?<=[.!?।])\s+/)) {
      const clean = sentence.replace(/\s*\.\.\.\s*$/, '').trim();
      if (clean.length < 40) continue;
      const tokens = clean.toLowerCase().split(/[^a-zऀ-ॿ0-9]+/);
      const score = tokens.filter((t) => words.has(t)).length + (s.trusted ? 1.5 : 0);
      scored.push({ text: clean, site: s.site, score });
    }
  }
  const seen = new Set<string>();
  return scored
    .sort((a, b) => b.score - a.score)
    .filter((s) => (seen.has(s.site) ? false : (seen.add(s.site), true)))
    .slice(0, max);
}

export async function answerFromRecordsAndWeb(question: string, intent: Intent, scope: MitraScope, context: FarmerContext): Promise<RetrievalAnswer> {
  const t = T[scope.language as Lang] ?? T.en;
  const d = context.diagnosis;
  const name = typeof context.profile.preferred_name === 'string' ? context.profile.preferred_name : null;
  const records = (answer: string, toolsUsed: string[] = []): RetrievalAnswer => ({ answer, mode: 'records', sources: [], toolsUsed: ['farmer_context', ...toolsUsed] });

  switch (intent) {
    case 'greeting':
      return { answer: t.hello(name), mode: 'guide', sources: [], toolsUsed: [] };
    case 'photo_tips':
      return { answer: t.tips, mode: 'guide', sources: [], toolsUsed: [] };
    case 'diagnosis': {
      if (!d) return records(t.noReport);
      const alternatives = Array.isArray(d.alternatives) ? (d.alternatives as string[]) : [];
      const parts = [t.report(d), typeof d.summary === 'string' ? d.summary : '', alternatives.length ? t.alternatives(alternatives) : '', t.review(String(d.expert_review_status ?? ''))];
      return records(parts.filter(Boolean).join(' '));
    }
    case 'guidance': {
      if (!d) return records(t.noReport);
      const g = context.guidance;
      if (g) {
        const steps = list([...(Array.isArray(g.inspection_steps) ? g.inspection_steps : []), ...(Array.isArray(g.prevention) ? g.prevention : [])]);
        const treatment = typeof g.approved_treatment === 'string' && g.approved_treatment ? `\n${withoutDoses(g.approved_treatment)}` : '';
        return records(`${t.report(d)}\n\n${t.approved(String(g.source ?? 'CropAI'))}\n${steps}${treatment}`);
      }
      const next = Array.isArray(d.next_steps) ? list(d.next_steps as unknown[]) : '';
      return records(`${t.report(d)}${next ? `\n\n${t.steps}\n${next}` : ''}\n\n${t.noGuidance}`);
    }
    case 'weather': {
      const w = context.weather ?? (await runMitraTool('get_local_weather', {}, scope));
      return records(w && w.weather !== null && 'temperature_c' in w ? t.weather(w) : t.noWeather, ['get_local_weather']);
    }
    case 'history': {
      const reports = [...(d ? [{ date: d.date, crop: d.crop, condition: d.predicted_condition, model_score: d.model_score }] : []), ...context.previous];
      if (!reports.length) return records(t.noHistory);
      return records(`${t.history(reports.length)}\n${reports.map((r) => `• ${r.date} — ${r.crop}: ${r.condition} (${r.model_score})`).join('\n')}`);
    }
    case 'expert': {
      const result = await runMitraTool('request_expert_assistance', {}, scope);
      return records(result.requested ? t.expert : t.expertNone, ['request_expert_assistance']);
    }
    default: {
      if (!researchConfigured()) return { answer: t.nothing, mode: 'guide', sources: [], toolsUsed: [] };
      const crop = typeof d?.crop === 'string' && intent !== 'schemes' ? d.crop : null;
      const sources = await searchFarmingWeb(intent === 'schemes' ? `${question} government scheme farmers` : question, { crop, timeoutMs: 7000 });
      const best = bestSentences(question, sources);
      if (!best.length) return { answer: t.nothing, mode: 'guide', sources: [], toolsUsed: ['tinyfish_search'] };
      return {
        answer: `${t.found}\n${best.map((b) => `• ${b.text} (${b.site})`).join('\n')}\n\n${t.confirm}`,
        mode: 'web',
        sources,
        toolsUsed: ['tinyfish_search'],
      };
    }
  }
}
