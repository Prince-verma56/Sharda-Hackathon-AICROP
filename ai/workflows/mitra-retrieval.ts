/**
 * Mitra answers WITHOUT a language model (used until a text LLM is available).
 *
 * Not canned replies: every answer is assembled from real data —
 *   records  the signed-in farmer's own report, next steps, expert-approved guidance, weather,
 *            past checks (same context loader as the LLM path and the voice call)
 *   web      TinyFish web search: the most relevant sentences from trusted sources, with links
 * Questions that describe a problem are answered even before any crop check (general information
 * + safe first steps), so the farmer is never told only "no data". Answers are labelled by source
 * in the UI and written in the farmer's Mitra language (Hinglish by default).
 */
import 'server-only';
import type { FarmerContext } from '@/ai/context/farmer-context';
import type { MitraLanguage } from '@/ai/settings/mitra-settings';
import { runMitraTool, type MitraScope } from '@/ai/voice/mitra-tools';
import { researchConfigured, searchFarmingWeb, withoutDoses, type WebSource } from '@/server/cropai/research';
import type { Intent } from './farmer-assistant';

export interface RetrievalAnswer {
  answer: string;
  mode: 'records' | 'web' | 'guide';
  sources: WebSource[];
  toolsUsed: string[];
}

type R = Record<string, unknown>;
interface Texts {
  hello: (name: string | null) => string;
  noReport: string;
  report: (d: R) => string;
  alternatives: (a: string[]) => string;
  review: (s: string) => string;
  steps: string;
  approved: (src: string) => string;
  noGuidance: string;
  weather: (w: R) => string;
  noWeather: string;
  history: (n: number) => string;
  noHistory: string;
  tips: string;
  expert: string;
  expertNone: string;
  found: string;
  confirm: string;
  nothing: string;
  generalNoCheck: string;
  firstSteps: string;
}

const T: Record<MitraLanguage, Texts> = {
  en: {
    hello: (name) =>
      `Hello${name ? ` ${name}` : ''}! I'm Mitra. I can explain your crop report, tell you what to do next, show your past checks and local weather, or look up farming information and government schemes. What would you like to know?`,
    noReport: 'You don’t have a crop check yet. Tap “Check my crop” and take a clear photo of one affected leaf — then I can explain the result.',
    report: (d) => `Your ${d.crop} check on ${d.date}: the AI model suggests ${d.predicted_condition} (model score ${d.model_score}). This is a screening result, not a confirmed diagnosis.`,
    alternatives: (a) => `Other possibilities the model considered: ${a.join(', ')}.`,
    review: (s) => (s === 'CONFIRMED' ? 'An expert has confirmed this result.' : s === 'PENDING' ? 'An expert review has been requested.' : ''),
    steps: 'What to do next:',
    approved: (src) => `Expert-approved guidance (${src}):`,
    noGuidance: 'There is no expert-approved treatment for this condition in CropAI yet. Please ask your agriculture officer or Krishi Vigyan Kendra (KVK) before using any chemical.',
    weather: (w) =>
      `Weather at your farm now: ${w.temperature_c ?? '—'}°C, humidity ${w.humidity_pct ?? '—'}%, rain in the last 24 hours ${w.rain_last_24h_mm ?? '—'} mm. This is weather context only, not a disease forecast.`,
    noWeather: 'Add your farm location in your profile and I can show the local weather.',
    history: (n) => `Your last ${n} crop checks:`,
    noHistory: 'You have no earlier crop checks yet.',
    tips: 'For a good photo: use daylight, take one affected leaf up close, fill the screen with the leaf and hold steady so it is not blurry.',
    expert: 'Done — I have sent your latest report to an agriculture expert. You will be notified when they reply.',
    expertNone: 'Please do a crop check first, so an expert has a report to review.',
    found: 'Here is what I found from trusted sources:',
    confirm: 'Please confirm with your agriculture officer, KVK or the official website before acting.',
    nothing: 'I couldn’t find reliable information on that right now. You can ask me about your crop report or weather, or call the Kisan Call Centre at 1800-180-1551 (free).',
    generalNoCheck: 'You haven’t done a crop check yet, so this is general information — a leaf photo with “Check my crop” gives a more specific result.',
    firstSteps: 'Safe first steps meanwhile: remove badly affected leaves and keep them away from the field, avoid watering over the leaves, keep the field clean and check nearby plants every 2–3 days.',
  },
  hinglish: {
    hello: (name) =>
      `Namaste${name ? ` ${name} ji` : ''}! Main Mitra hoon. Main aapki crop report samjha sakta hoon, aage kya karna hai bata sakta hoon, purani checks aur mausam dikha sakta hoon, ya kheti aur sarkari yojanaon ki jaankari dhoondh sakta hoon. Bataiye, kya jaanna hai?`,
    noReport: 'Abhi aapki koi crop check nahi hui hai. “Check my crop” dabaiye aur ek prabhavit patte ki saaf photo lijiye — phir main result samjhaunga.',
    report: (d) => `${d.date} ko aapki ${d.crop} check mein AI model ne “${d.predicted_condition}” jaise sanket dekhe (model score ${d.model_score}). Yeh screening hai, pakki diagnosis nahi.`,
    alternatives: (a) => `Model ne yeh sambhavnayein bhi dekhin: ${a.join(', ')}.`,
    review: (s) => (s === 'CONFIRMED' ? 'Expert ne is result ki pushti ki hai.' : s === 'PENDING' ? 'Expert review ka request bheja gaya hai.' : ''),
    steps: 'Aage kya karein:',
    approved: (src) => `Expert-approved salah (${src}):`,
    noGuidance: 'Is condition ke liye CropAI mein abhi expert-approved ilaaj nahi hai. Koi bhi dawa use karne se pehle apne krishi adhikari ya Krishi Vigyan Kendra (KVK) se poochhiye.',
    weather: (w) =>
      `Aapke khet par abhi mausam: ${w.temperature_c ?? '—'}°C, humidity ${w.humidity_pct ?? '—'}%, pichhle 24 ghante mein baarish ${w.rain_last_24h_mm ?? '—'} mm. Yeh sirf mausam ki jaankari hai, bimari ka anumaan nahi.`,
    noWeather: 'Profile mein apne khet ki location jodiye, phir main local mausam bata paunga.',
    history: (n) => `Aapki pichhli ${n} crop checks:`,
    noHistory: 'Abhi aapki koi purani check nahi hai.',
    tips: 'Achhi photo ke liye: din ki roshni mein, ek prabhavit patta paas se lijiye, patte se poori screen bhariye aur phone sthir rakhiye taaki photo dhundhli na ho.',
    expert: 'Ho gaya — maine aapki aakhri report krishi expert ko bhej di hai. Jawab aane par aapko suchna milegi.',
    expertNone: 'Pehle ek crop check kijiye, taaki expert ke paas dekhne ke liye report ho.',
    found: 'Bharosemand sources se mujhe yeh jaankari mili:',
    confirm: 'Kuch bhi karne se pehle apne krishi adhikari, KVK ya official website se pushti kar lijiye.',
    nothing: 'Abhi mujhe is par bharosemand jaankari nahi mili. Aap apni crop report ya mausam ke baare mein pooch sakte hain, ya Kisan Call Centre 1800-180-1551 (free) par call kijiye.',
    generalNoCheck: 'Abhi aapki koi crop check nahi hui hai, isliye yeh general jaankari hai — “Check my crop” se patte ki photo lene par zyada sahi result milega.',
    firstSteps: 'Tab tak yeh safe kadam uthaiye: zyada kharab patte tod kar khet se door kar dijiye, patton par upar se paani mat daliye, khet saaf rakhiye aur aas-paas ke paudhon ko har 2–3 din mein dekhiye.',
  },
  hi: {
    hello: (name) =>
      `नमस्ते${name ? ` ${name} जी` : ''}! मैं मित्र हूँ। मैं आपकी फसल रिपोर्ट समझा सकता हूँ, आगे क्या करना है बता सकता हूँ, पिछली जाँच और मौसम दिखा सकता हूँ, या खेती और सरकारी योजनाओं की जानकारी ढूँढ सकता हूँ। आप क्या जानना चाहेंगे?`,
    noReport: 'अभी आपकी कोई फसल जाँच नहीं है। “फसल जांचें” दबाकर एक प्रभावित पत्ती की साफ़ फोटो लें — फिर मैं नतीजा समझाऊँगा।',
    report: (d) => `${d.date} को आपकी ${d.crop} की जाँच में AI मॉडल ने “${d.predicted_condition}” जैसे संकेत पाए (मॉडल स्कोर ${d.model_score})। यह स्क्रीनिंग है, पक्की पुष्टि नहीं।`,
    alternatives: (a) => `मॉडल ने ये संभावनाएँ भी देखीं: ${a.join(', ')}।`,
    review: (s) => (s === 'CONFIRMED' ? 'विशेषज्ञ ने इस नतीजे की पुष्टि की है।' : s === 'PENDING' ? 'विशेषज्ञ से जाँच का अनुरोध भेजा गया है।' : ''),
    steps: 'आगे क्या करें:',
    approved: (src) => `विशेषज्ञ-स्वीकृत सलाह (${src}):`,
    noGuidance: 'इस स्थिति के लिए CropAI में अभी विशेषज्ञ-स्वीकृत उपचार नहीं है। कोई भी दवा इस्तेमाल करने से पहले अपने कृषि अधिकारी या कृषि विज्ञान केंद्र (KVK) से पूछें।',
    weather: (w) =>
      `आपके खेत पर अभी मौसम: ${w.temperature_c ?? '—'}°C, नमी ${w.humidity_pct ?? '—'}%, पिछले 24 घंटे में बारिश ${w.rain_last_24h_mm ?? '—'} मिमी। यह सिर्फ़ मौसम की जानकारी है, बीमारी का अनुमान नहीं।`,
    noWeather: 'प्रोफ़ाइल में अपने खेत की जगह जोड़ें, फिर मैं स्थानीय मौसम बता पाऊँगा।',
    history: (n) => `आपकी पिछली ${n} फसल जाँच:`,
    noHistory: 'अभी आपकी कोई पिछली जाँच नहीं है।',
    tips: 'अच्छी फोटो के लिए: दिन की रोशनी में, एक प्रभावित पत्ती पास से लें, पत्ती से पूरी स्क्रीन भरें और फोन स्थिर रखें ताकि फोटो धुंधली न हो।',
    expert: 'हो गया — मैंने आपकी आखिरी रिपोर्ट कृषि विशेषज्ञ को भेज दी है। जवाब आने पर आपको सूचना मिलेगी।',
    expertNone: 'पहले एक फसल जाँच करें, ताकि विशेषज्ञ के पास देखने के लिए रिपोर्ट हो।',
    found: 'भरोसेमंद स्रोतों से मुझे यह जानकारी मिली:',
    confirm: 'कुछ भी करने से पहले अपने कृषि अधिकारी, KVK या आधिकारिक वेबसाइट से पुष्टि कर लें।',
    nothing: 'अभी मुझे इस पर भरोसेमंद जानकारी नहीं मिली। आप अपनी फसल रिपोर्ट या मौसम के बारे में पूछ सकते हैं, या किसान कॉल सेंटर 1800-180-1551 (मुफ़्त) पर कॉल करें।',
    generalNoCheck: 'अभी आपकी कोई फसल जाँच नहीं है, इसलिए यह सामान्य जानकारी है — “फसल जांचें” से पत्ती की फोटो लेने पर ज़्यादा सटीक नतीजा मिलेगा।',
    firstSteps: 'तब तक ये सुरक्षित कदम उठाइए: ज़्यादा खराब पत्ते तोड़कर खेत से दूर कर दीजिए, पत्तों पर ऊपर से पानी मत डालिए, खेत साफ़ रखिए और आसपास के पौधों को हर 2–3 दिन में देखिए।',
  },
};

/** The farmer explicitly asks about THEIR report/result (vs. describing a problem). */
const ASKS_FOR_REPORT = /\b(my|meri|mera)\b.*\b(report|result|check)\b|\breport\b|\bresult\b|रिपोर्ट|नतीजा/i;

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
      // skip citation/metadata fragments ("by A Author · 2009 · Cited by 5479 —", DOIs, "et al.")
      if (clean.length < 40 || /cited by \d|\bet al\b|\bdoi\b|^by [A-Z]|·\s*(19|20)\d\d\s*·/i.test(clean)) continue;
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

export async function answerFromRecordsAndWeb(
  question: string,
  intent: Intent,
  scope: MitraScope,
  context: FarmerContext,
  replyLanguage?: MitraLanguage,
): Promise<RetrievalAnswer> {
  const t = T[replyLanguage ?? (scope.language === 'hi' ? 'hi' : 'en')];
  const d = context.diagnosis;
  const name = typeof context.profile.preferred_name === 'string' ? context.profile.preferred_name : null;
  const records = (answer: string, toolsUsed: string[] = []): RetrievalAnswer => ({ answer, mode: 'records', sources: [], toolsUsed: ['farmer_context', ...toolsUsed] });

  /** Trusted web information for a question (+ an optional lead line and closing advice). */
  async function fromWeb(query: string, crop: string | null, lead?: string, closing?: string): Promise<RetrievalAnswer> {
    const tail = [closing, t.confirm].filter(Boolean).join('\n\n');
    if (!researchConfigured()) {
      return { answer: [lead, closing ?? t.nothing].filter(Boolean).join('\n\n'), mode: 'guide', sources: [], toolsUsed: [] };
    }
    const sources = await searchFarmingWeb(query, { crop, timeoutMs: 7000 });
    const best = bestSentences(question, sources);
    if (!best.length) return { answer: [lead, closing ?? t.nothing].filter(Boolean).join('\n\n'), mode: 'guide', sources: [], toolsUsed: ['tinyfish_search'] };
    return {
      answer: [lead, `${t.found}\n${best.map((b) => `• ${withoutDoses(b.text)} (${b.site})`).join('\n')}`, tail].filter(Boolean).join('\n\n'),
      mode: 'web',
      sources,
      toolsUsed: ['tinyfish_search'],
    };
  }

  switch (intent) {
    case 'greeting':
      return { answer: t.hello(name), mode: 'guide', sources: [], toolsUsed: [] };
    case 'photo_tips':
      return { answer: t.tips, mode: 'guide', sources: [], toolsUsed: [] };
    case 'diagnosis': {
      if (!d) {
        // Describing a problem before any check: still help (general info + safe steps).
        return ASKS_FOR_REPORT.test(question) ? records(t.noReport) : fromWeb(`${question} crop leaf symptoms causes`, null, t.generalNoCheck, t.firstSteps);
      }
      const alternatives = Array.isArray(d.alternatives) ? (d.alternatives as string[]) : [];
      const parts = [t.report(d), typeof d.summary === 'string' ? d.summary : '', alternatives.length ? t.alternatives(alternatives) : '', t.review(String(d.expert_review_status ?? ''))];
      return records(parts.filter(Boolean).join(' '));
    }
    case 'guidance': {
      if (!d) return fromWeb(`${question} crop management`, null, t.generalNoCheck, t.firstSteps);
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
      const crop = typeof d?.crop === 'string' && intent !== 'schemes' ? d.crop : null;
      return fromWeb(intent === 'schemes' ? `${question} government scheme farmers` : question, crop);
    }
  }
}
