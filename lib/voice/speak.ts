/**
 * "Listen" buttons — the device's own speech engine (instant, free, works without a call).
 *
 * Voice choice follows the SCRIPT of the text, so Hinglish sounds right:
 *   Devanagari (Hindi / Hinglish like "आपके tomato के पत्ते पर…")  → a Hindi voice, which also
 *     reads the English words; on Edge this is "Microsoft Swara Online (Natural)" — the same Azure
 *     voice Mitra uses on calls
 *   Roman script (English / Roman Hinglish like "Aapke patte par…")  → an Indian-English voice
 * Long text is spoken sentence by sentence (some browsers stop long utterances after ~15 s).
 */
const DEVANAGARI = /[ऀ-ॿ]/;

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const now = synth.getVoices();
    if (now.length) return resolve(now);
    const done = () => resolve(synth.getVoices());
    synth.addEventListener('voiceschanged', done, { once: true });
    window.setTimeout(done, 1200); // some browsers never fire voiceschanged
  });
  return voicesReady;
}

function rank(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase();
  return (name.includes('natural') || name.includes('online') ? 4 : 0) + (name.includes('swara') || name.includes('neerja') ? 2 : 0) + (name.includes('google') ? 1 : 0);
}

function pickVoice(voices: SpeechSynthesisVoice[], hindi: boolean) {
  const wanted = hindi ? (v: SpeechSynthesisVoice) => /^hi/i.test(v.lang) : (v: SpeechSynthesisVoice) => /^en[-_]IN/i.test(v.lang);
  const matches = voices.filter(wanted).sort((a, b) => rank(b) - rank(a));
  if (matches.length) return matches[0];
  return hindi ? null : (voices.find((v) => /^en/i.test(v.lang)) ?? null);
}

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/**
 * Speaks `text`. `fallback` (Roman/English) is used when the text is Devanagari but the device
 * has no Hindi voice. Resolves when finished or stopped.
 */
export async function speakText(text: string, options: { fallback?: string; rate?: number; onEnd?: () => void } = {}): Promise<void> {
  if (!canSpeak() || !text.trim()) return options.onEnd?.();
  const synth = window.speechSynthesis;
  synth.cancel();
  const voices = await loadVoices();
  let say = text;
  let hindi = DEVANAGARI.test(say);
  let voice = pickVoice(voices, hindi);
  if (hindi && !voice && options.fallback) {
    say = options.fallback;
    hindi = DEVANAGARI.test(say);
    voice = pickVoice(voices, hindi);
  }
  const parts = say.split(/(?<=[.!?।])\s+/).filter((p) => p.trim());
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    u.lang = voice?.lang ?? (hindi ? 'hi-IN' : 'en-IN');
    if (voice) u.voice = voice;
    u.rate = options.rate ?? 0.95;
    if (i === parts.length - 1) {
      u.onend = () => options.onEnd?.();
      u.onerror = () => options.onEnd?.();
    }
    synth.speak(u);
  });
}
