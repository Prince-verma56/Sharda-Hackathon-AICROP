'use client';

/**
 * Mitra — one conversation, two ways to talk (voice via Vapi, text via /api/v1/assistant/chat).
 * Both use the same server-side brain (ai/agents/mitra.ts) and the same server-held history.
 *
 * Voice: the Vapi SDK is loaded and instantiated once when the page opens (listeners registered
 * once, removed on unmount). Tapping the mic runs session config, SDK readiness and (only when not
 * yet granted) microphone permission in parallel, then starts the call. Real SDK events drive
 * every state: call-start-progress/-success/-failed, call-start, call-end, error, speech-start/-end,
 * volume-level (Mitra), local-volume-level (farmer's mic), message: transcript (partial/final),
 * speech-update, status-update (endedReason), user-interrupted. Audio is never recorded.
 *
 * Design follows the public site: display headings, small tracked labels, photo panel with
 * stat chips, pill buttons and feature-row tiles.
 */
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type Vapi from '@vapi-ai/web';
import {
  AlertCircle,
  ArrowDown,
  ArrowUpRight,
  CloudSun,
  FileText,
  Globe,
  History,
  Landmark,
  ListChecks,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  Trash2,
  Volume2,
} from 'lucide-react';
import { Accent, PageIntro, labelClass } from '@/components/app/page-intro';
import { LeafMark } from '@/components/marketing/home/brand';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { LiveWaveform } from '@/components/ui/voice/live-waveform';
import { cn } from '@/lib/utils';
import { cleanTranscript } from '@/lib/voice/clean-transcript';
import { speakText, stopSpeaking } from '@/lib/voice/speak';

type Phase = 'idle' | 'preparing' | 'permission' | 'connecting' | 'live' | 'ended' | 'failed';
type LiveState = 'listening' | 'farmer' | 'processing' | 'mitra';
type AnswerMode = 'ai' | 'records' | 'web' | 'guide';
interface Source {
  title: string;
  url: string;
  site: string;
  trusted: boolean;
}
interface Message {
  id: string;
  role: 'farmer' | 'mitra';
  text: string;
  channel: 'voice' | 'text';
  pending?: boolean;
  error?: 'config' | 'failed';
  retry?: string;
  sources?: Source[];
  mode?: AnswerMode;
}
export interface MitraReportContext {
  id: string;
  crop: string;
  condition: string;
  date: string;
  healthy: boolean;
}

const SUGGESTION_ICONS = [FileText, ListChecks, CloudSun, Landmark] as const;

const L = {
  en: {
    eyebrow: 'AI farming mentor',
    titleA: 'Talk to',
    tagline: 'Voice or text · Hinglish, Hindi or English',
    voice: 'Voice',
    languages: 'Languages',
    audioStored: 'Audio stored',
    ready: 'Ready',
    preparing: 'Preparing Mitra…',
    permission: 'Allow the microphone in your browser…',
    connecting: 'Connecting…',
    slow: 'Still connecting — this network is slow. Please wait a few seconds.',
    live: 'Live',
    listening: 'Listening — speak now',
    farmer: 'You’re speaking',
    processing: 'Mitra is thinking…',
    mitra: 'Mitra is speaking',
    muted: 'Microphone muted',
    ended: 'Call ended',
    failed: 'Could not connect',
    tap: 'Tap to talk to Mitra',
    tapAgain: 'Tap to talk again',
    start: 'Start voice call',
    retry: 'Try again',
    end: 'End call',
    mute: 'Mute',
    unmute: 'Unmute',
    you: 'You',
    placeholder: 'Ask Mitra anything about your crop…',
    sendDuringCall: 'Type to Mitra during the call…',
    privacy: 'Voice is never recorded.',
    micDenied: 'Microphone access is blocked. Click the lock icon in the address bar, allow the microphone, then try again — or type below.',
    noMic: 'No microphone was found. You can type your question instead.',
    timeout: 'Mitra could not connect. Check your internet and try again, or type your question.',
    voiceFailed: 'The voice call could not start. Try again or type your question.',
    silence: 'The call ended after a long silence.',
    notConfigured: 'Mitra could not answer right now. Please try again.',
    answerFailed: 'Mitra could not answer that. Please try again.',
    sources: 'Sources',
    modes: { ai: 'AI answer', records: 'From your CropAI records', web: 'From trusted websites · not expert-verified', guide: '' } as Record<AnswerMode, string>,
    emptyEyebrow: 'Ask anything',
    emptyTitleA: 'Your farming',
    emptyTitleB: 'mentor',
    empty: 'Mitra knows your reports, your crops and your local weather. Speak or type — in Hindi or English.',
    suggestions: [
      { tag: 'Report', title: 'Explain my latest report' },
      { tag: 'Next steps', title: 'What should I do next?' },
      { tag: 'Weather', title: 'Check my local weather' },
      { tag: 'Support', title: 'Government support for farmers' },
    ],
    report: 'Your latest check',
    noReport: 'No crop check yet. Take a leaf photo and Mitra will explain the result.',
    checkCrop: 'Check my crop',
    language: 'English',
    connectedIn: (s: string) => `Connected in ${s} s`,
    replay: 'Listen',
    conversation: 'Conversation',
    history: 'History',
    saved: 'Saved',
    notSaved: 'Not saved',
    newChat: 'New',
    saveChats: 'Save my text chats so Mitra remembers them next time',
    saveVoice: 'Also save voice-call transcripts (audio is never recorded)',
    consentNote: 'Your choice, any time. Without saving, Mitra remembers this conversation for 24 hours only.',
    deleteHistory: 'Delete saved history',
    confirmDelete: 'Tap again to delete everything',
    earlier: 'Earlier conversations',
    latest: 'Latest',
    settings: 'Settings',
  },
  hi: {
    eyebrow: 'AI खेती सलाहकार',
    titleA: 'बात करें',
    tagline: 'बोलकर या लिखकर · हिंग्लिश, हिंदी या English',
    voice: 'आवाज़',
    languages: 'भाषाएँ',
    audioStored: 'आवाज़ सेव',
    ready: 'तैयार',
    preparing: 'मित्र तैयार हो रहा है…',
    permission: 'ब्राउज़र में माइक्रोफ़ोन की अनुमति दें…',
    connecting: 'जुड़ रहे हैं…',
    slow: 'अभी जुड़ रहे हैं — नेटवर्क धीमा है। कृपया कुछ सेकंड रुकें।',
    live: 'लाइव',
    listening: 'सुन रहा हूँ — अब बोलिए',
    farmer: 'आप बोल रहे हैं',
    processing: 'मित्र सोच रहा है…',
    mitra: 'मित्र बोल रहा है',
    muted: 'माइक बंद है',
    ended: 'बातचीत खत्म हुई',
    failed: 'जुड़ नहीं पाए',
    tap: 'मित्र से बात करने के लिए दबाएँ',
    tapAgain: 'फिर से बात करने के लिए दबाएँ',
    start: 'वॉइस कॉल शुरू करें',
    retry: 'फिर कोशिश करें',
    end: 'कॉल खत्म करें',
    mute: 'म्यूट',
    unmute: 'अनम्यूट',
    you: 'आप',
    placeholder: 'अपनी फसल के बारे में मित्र से कुछ भी पूछें…',
    sendDuringCall: 'कॉल के दौरान मित्र को लिखें…',
    privacy: 'आवाज़ कभी रिकॉर्ड नहीं होती।',
    micDenied: 'माइक्रोफ़ोन की अनुमति बंद है। एड्रेस बार में ताले के निशान पर क्लिक करके माइक्रोफ़ोन चालू करें और फिर कोशिश करें — या नीचे लिखें।',
    noMic: 'कोई माइक्रोफ़ोन नहीं मिला। आप लिखकर पूछ सकते हैं।',
    timeout: 'मित्र से जुड़ नहीं पाए। इंटरनेट जाँचकर फिर कोशिश करें, या लिखकर पूछें।',
    voiceFailed: 'वॉइस कॉल शुरू नहीं हो सकी। फिर कोशिश करें या लिखकर पूछें।',
    silence: 'लंबी चुप्पी के बाद कॉल खत्म हो गई।',
    notConfigured: 'मित्र अभी जवाब नहीं दे सका। कृपया फिर कोशिश करें।',
    answerFailed: 'मित्र इसका जवाब नहीं दे सका। कृपया फिर कोशिश करें।',
    sources: 'स्रोत',
    modes: { ai: 'AI जवाब', records: 'आपके CropAI रिकॉर्ड से', web: 'भरोसेमंद वेबसाइटों से · विशेषज्ञ-सत्यापित नहीं', guide: '' } as Record<AnswerMode, string>,
    emptyEyebrow: 'कुछ भी पूछें',
    emptyTitleA: 'आपका खेती',
    emptyTitleB: 'साथी',
    empty: 'मित्र आपकी रिपोर्ट, फसल और स्थानीय मौसम जानता है। हिंदी या English में बोलें या लिखें।',
    suggestions: [
      { tag: 'रिपोर्ट', title: 'मेरी आखिरी रिपोर्ट समझाइए' },
      { tag: 'आगे क्या', title: 'अब मुझे क्या करना चाहिए?' },
      { tag: 'मौसम', title: 'मेरे इलाके का मौसम बताइए' },
      { tag: 'सहायता', title: 'किसानों के लिए सरकारी योजनाएँ' },
    ],
    report: 'आपकी आखिरी जाँच',
    noReport: 'अभी कोई जाँच नहीं है। पत्ती की फोटो लें, फिर मित्र नतीजा समझाएगा।',
    checkCrop: 'फसल जांचें',
    language: 'हिंदी',
    connectedIn: (s: string) => `${s} सेकंड में जुड़ा`,
    replay: 'सुनें',
    conversation: 'बातचीत',
    history: 'इतिहास',
    saved: 'सेव है',
    notSaved: 'सेव नहीं',
    newChat: 'नई',
    saveChats: 'मेरी लिखी बातचीत सेव करें ताकि मित्र अगली बार याद रखे',
    saveVoice: 'वॉइस कॉल का लिखित रूप भी सेव करें (आवाज़ कभी रिकॉर्ड नहीं होती)',
    consentNote: 'यह आपकी मर्ज़ी है, कभी भी बदलें। सेव न करने पर मित्र यह बातचीत सिर्फ़ 24 घंटे याद रखता है।',
    deleteHistory: 'सेव की गई बातचीत मिटाएँ',
    confirmDelete: 'सब मिटाने के लिए फिर दबाएँ',
    earlier: 'पिछली बातचीत',
    latest: 'नए संदेश',
    settings: 'सेटिंग्स',
  },
};

/** Vapi call creation + WebRTC join measured at 4–16 s on this network; allow slow networks. */
const CONNECT_TIMEOUT_MS = 45_000;
const SLOW_CONNECT_HINT_MS = 8_000;
const uid = () => Math.random().toString(36).slice(2, 10);
/** Clock helpers (only ever called from event handlers / SDK callbacks). */
const nowMs = () => performance.now();
const epochMs = () => Date.now();

/**
 * Asks for the microphone only when the browser has not granted it yet (clear prompt + clear
 * "denied" message before the call). When already granted, the device is left to the call.
 */
async function ensureMicrophone(): Promise<'granted' | 'prompted'> {
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    if (status?.state === 'granted') return 'granted';
  } catch {
    // Permissions API without "microphone" (e.g. Firefox): fall through and ask.
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
  return 'prompted';
}

export function MitraClient({
  lang,
  diagnosisId,
  voiceAvailable,
  publicKey,
  assistantName,
  report,
  initialConversationId,
  initialMessages,
  initialConsent,
  savedConversations,
  initialQuestion,
  autoVoice = false,
}: {
  lang: string;
  diagnosisId: string | null;
  voiceAvailable: boolean;
  publicKey: string | null;
  assistantName: string;
  report: MitraReportContext | null;
  initialConversationId: string | null;
  initialMessages: Message[];
  initialConsent: { chatHistory: boolean; voiceTranscripts: boolean };
  savedConversations: { id: string; title: string; date: string }[];
  /** asked automatically once (e.g. a mentor question from a report) */
  initialQuestion?: string | null;
  /** opened with "Ask Mitra" from a report: start the voice call straight away (Mitra opens with the report) */
  autoVoice?: boolean;
}) {
  const l = lang === 'hi' ? L.hi : L.en;
  const label = labelClass(lang);
  const displayName = lang === 'hi' && assistantName === 'Mitra' ? 'मित्र' : assistantName;
  const [phase, setPhase] = useState<Phase>('idle');
  const [live, setLive] = useState<LiveState>('listening');
  const [muted, setMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [mitraLevel, setMitraLevel] = useState(0);
  const [partial, setPartial] = useState('');
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [consent, setConsent] = useState(initialConsent);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [connectSeconds, setConnectSeconds] = useState<string | null>(null);
  const [slowConnect, setSlowConnect] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const vapiRef = useRef<Vapi | null>(null);
  const sdkReady = useRef<Promise<Vapi | null> | null>(null);
  const sessionRef = useRef<{ id: string; started: number } | null>(null);
  const clickAt = useRef(0);
  const endedReason = useRef<string | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const messagesRef = useRef<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textsRef = useRef(l);
  const conversationRef = useRef<string | null>(initialConversationId);
  /** the call turn in progress (merged fragments), saved once the speaker changes or the call ends */
  const pendingVoice = useRef<{ role: 'farmer' | 'mitra'; text: string; turnId: string; modality: 'voice_transcript' | 'text' } | null>(null);
  const callKey = useRef('');
  const voiceSeq = useRef(0);
  const askedInitial = useRef(false);
  /**
   * Mitra's words come from the model's own text — `model-output` tokens grouped by turnId, and the
   * configured greeting — never from re-transcribing Mitra's synthesized voice (that misheard "Hi"
   * as Thai). The assistant transcript is only a cleaned fallback if no model output ever arrives.
   */
  const greetingRef = useRef<string | null>(null);
  const greetingSpeaking = useRef(false);
  const modelTurn = useRef<{ turnId: string; messageId: string } | null>(null);
  const droppedTurns = useRef(new Set<string>());
  const sawModelOutput = useRef(false);
  const replySeq = useRef(0);
  const assistantHeard = useRef('');

  // Keep refs current for SDK callbacks and handlers (never read refs during render).
  useEffect(() => {
    textsRef.current = l;
    phaseRef.current = phase;
    messagesRef.current = messages;
    conversationRef.current = conversationId;
  });

  // Chat-app scrolling: follow new messages only while the farmer is at the bottom (reading older
  // messages is never interrupted); otherwise offer a "latest" button.
  const atBottomRef = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const scrollToLatest = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  };
  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = atBottom;
    setShowLatest(!atBottom);
  }
  useEffect(() => {
    const own = messages.at(-1)?.role === 'farmer';
    if (atBottomRef.current || own) scrollToLatest(own ? 'smooth' : 'auto');
  }, [messages, partial]);
  useEffect(() => scrollToLatest('auto'), []); // open at the latest message

  function mark(stage: string, extra?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[mitra] +${Math.round(nowMs() - clickAt.current)} ms ${stage}`, extra ?? '');
    }
  }

  /**
   * Sends a finished call turn to the server: kept in the 24 h working copy; stored in PostgreSQL
   * only with consent (voice transcripts → voice consent, text typed during a call → chat consent).
   */
  function flushVoiceTurn() {
    const turn = pendingVoice.current;
    pendingVoice.current = null;
    const id = conversationRef.current;
    if (!turn || !id || !turn.text.trim()) return;
    void fetch(`/api/v1/assistant/conversations/${id}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turns: [{ ...turn, text: turn.text.trim() }] }),
      keepalive: true,
    }).catch(() => undefined);
  }

  /** Opens a new bubble (and server turn) for the call; the previous speaker's turn is saved first. */
  function beginVoiceTurn(role: 'farmer' | 'mitra', text: string, modality: 'voice_transcript' | 'text' = 'voice_transcript') {
    flushVoiceTurn();
    if (role === 'farmer') replySeq.current += 1;
    voiceSeq.current += 1;
    pendingVoice.current = { role, text, turnId: `${callKey.current}:${voiceSeq.current}`, modality };
    const id = uid();
    setMessages((prev) => [...prev, { id, role, text, channel: modality === 'text' ? 'text' : 'voice' }]);
    return id;
  }

  /** The farmer's speech: final transcript fragments merge into one bubble until Mitra replies. */
  function appendFarmerSpeech(transcript: string) {
    const clean = cleanTranscript(transcript);
    if (!clean) return;
    const turn = pendingVoice.current;
    if (turn?.role !== 'farmer' || turn.modality !== 'voice_transcript') {
      beginVoiceTurn('farmer', clean);
      return;
    }
    turn.text = `${turn.text} ${clean}`;
    const merged = turn.text;
    setMessages((prev) => {
      const last = prev.at(-1);
      return last?.role === 'farmer' && last.channel === 'voice' ? [...prev.slice(0, -1), { ...last, text: merged }] : [...prev, { id: uid(), role: 'farmer', text: merged, channel: 'voice' }];
    });
  }

  /** Mitra's reply streamed from the model's own tokens: the exact words, shown as they are generated. */
  function appendMitraToken(turnId: string, token: string) {
    if (droppedTurns.current.has(turnId)) return;
    const current = modelTurn.current;
    const turn = pendingVoice.current;
    if (current?.turnId === turnId && turn?.role === 'mitra') {
      turn.text += token;
      const text = turn.text;
      setMessages((prev) => prev.map((m) => (m.id === current.messageId ? { ...m, text } : m)));
      return;
    }
    if (!token.trim()) return; // never open a bubble on leading whitespace
    modelTurn.current = { turnId, messageId: beginVoiceTurn('mitra', token.trimStart()) };
  }

  async function closeSession() {
    const s = sessionRef.current;
    sessionRef.current = null;
    if (s) {
      await fetch('/api/v1/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ end: s.id, durationSeconds: Math.round((epochMs() - s.started) / 1000) }),
      }).catch(() => undefined);
    }
  }

  // Load + instantiate the SDK once, register listeners once, clean up on leave.
  useEffect(() => {
    if (!voiceAvailable || !publicKey) return;
    let disposed = false;
    sdkReady.current = import('@vapi-ai/web')
      .then(({ default: VapiCtor }) => {
        if (disposed) return null;
        const vapi = new VapiCtor(publicKey);
        vapi.on('call-start-progress', (e) => mark(`${e.stage}:${e.status}`, e.duration ? `${e.duration} ms` : ''));
        vapi.on('call-start-success', (e) => mark('call-start-success', `${e.totalDuration} ms`));
        vapi.on('call-start-failed', (e) => {
          mark('call-start-failed', e.stage);
          setVoiceError(textsRef.current.voiceFailed);
          setSlowConnect(false);
          setPhase('failed');
          void closeSession();
        });
        vapi.on('call-start', () => {
          mark('call-start');
          setConnectSeconds(((nowMs() - clickAt.current) / 1000).toFixed(1));
          setSlowConnect(false);
          setPhase('live');
          setLive('listening');
          modelTurn.current = null;
          droppedTurns.current.clear();
          sawModelOutput.current = false;
          assistantHeard.current = '';
          // Mitra speaks first: show the configured greeting text exactly.
          const greeting = greetingRef.current;
          greetingSpeaking.current = Boolean(greeting);
          if (greeting) beginVoiceTurn('mitra', greeting);
        });
        vapi.on('speech-start', () => setLive('mitra'));
        vapi.on('speech-end', () => {
          setLive('listening');
          setMitraLevel(0);
        });
        vapi.on('volume-level', (v) => setMitraLevel(v));
        vapi.on('local-volume-level', (v) => setMicLevel(v));
        vapi.on('message', (m: Record<string, unknown>) => {
          if (m.type === 'model-output') {
            if (typeof m.output !== 'string') return; // tool-call chunks
            sawModelOutput.current = true;
            assistantHeard.current = '';
            appendMitraToken(typeof m.turnId === 'string' ? m.turnId : `reply-${replySeq.current}`, m.output);
          } else if (m.type === 'transcript') {
            const transcript = String(m.transcript ?? '');
            if (m.role === 'user') {
              if (m.transcriptType === 'partial') {
                setPartial(cleanTranscript(transcript));
                setLive('farmer');
              } else {
                setPartial('');
                appendFarmerSpeech(transcript);
                setLive('processing');
              }
            } else if (m.transcriptType === 'final' && !sawModelOutput.current) {
              assistantHeard.current = `${assistantHeard.current} ${transcript}`; // fallback only
            }
          } else if (m.type === 'speech-update') {
            if (m.role === 'user') {
              setLive(m.status === 'started' ? 'farmer' : 'processing');
            } else {
              setLive(m.status === 'started' ? 'mitra' : 'listening');
              if (m.status === 'stopped') {
                const heard = assistantHeard.current;
                assistantHeard.current = '';
                if (greetingSpeaking.current) {
                  greetingSpeaking.current = false; // greeting text came from the config
                } else if (!sawModelOutput.current) {
                  const clean = cleanTranscript(heard);
                  if (clean) beginVoiceTurn('mitra', clean);
                }
              }
            }
          } else if (m.type === 'user-interrupted') {
            setLive('farmer');
            // Tokens of the interrupted reply that are still in flight are discarded (per Vapi docs).
            if (modelTurn.current) droppedTurns.current.add(modelTurn.current.turnId);
          } else if (m.type === 'status-update' && m.status === 'ended') {
            endedReason.current = typeof m.endedReason === 'string' ? m.endedReason : null;
          }
        });
        vapi.on('call-end', () => {
          flushVoiceTurn();
          setPhase((p) => (p === 'failed' ? p : 'ended'));
          setSlowConnect(false);
          setPartial('');
          setMicLevel(0);
          setMitraLevel(0);
          if (endedReason.current?.includes('silence')) setVoiceError(textsRef.current.silence);
          void closeSession();
        });
        vapi.on('error', (e: Record<string, unknown>) => {
          const inner = (e?.error ?? {}) as Record<string, unknown>;
          const detail = (inner.error ?? inner.message ?? {}) as Record<string, unknown>;
          // Daily reports a server-side hang-up as an "ejected / Meeting has ended" error: that is a normal end.
          if (detail?.type === 'ejected' || /meeting has ended/i.test(String(inner.errorMsg ?? ''))) {
            flushVoiceTurn();
            setPhase((p) => (p === 'failed' ? p : 'ended'));
            setPartial('');
            void closeSession();
            return;
          }
          console.error('[mitra] voice error', e?.type ?? e);
          setVoiceError(textsRef.current.voiceFailed);
          setSlowConnect(false);
          setPhase('failed');
          void closeSession();
        });
        vapiRef.current = vapi;
        return vapi;
      })
      .catch(() => null);
    return () => {
      disposed = true;
      const vapi = vapiRef.current;
      vapiRef.current = null;
      if (vapi) {
        void vapi.stop().catch(() => undefined);
        vapi.removeAllListeners();
      }
      void closeSession();
    };
    // The SDK instance is created once per key; its listeners only call stable setters and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceAvailable, publicKey]);

  async function startCall() {
    if (['preparing', 'permission', 'connecting', 'live'].includes(phaseRef.current)) return;
    phaseRef.current = 'preparing'; // block double taps before the next render
    stopSpeaking(); // never talk over Mitra
    clickAt.current = nowMs();
    endedReason.current = null;
    setVoiceError(null);
    setConnectSeconds(null);
    setSlowConnect(false);
    setMuted(false);
    setPhase('preparing');
    mark('tap');
    const slowPermission = window.setTimeout(() => setPhase((p) => (p === 'preparing' ? 'permission' : p)), 600);
    try {
      callKey.current = `call-${epochMs().toString(36)}-${uid()}`;
      voiceSeq.current = 0;
      const [session, vapi] = await Promise.all([
        fetch('/api/v1/voice/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ diagnosisId, conversationId: conversationRef.current }),
        }).then(
          (r) =>
            r.json() as Promise<{
              success: boolean;
              data?: { voiceSessionId: string; conversationId: string; assistant: Record<string, unknown> };
              error?: { message?: string };
            }>,
        ),
        sdkReady.current ?? Promise.resolve(null),
        ensureMicrophone().then((state) => mark(`microphone ${state}`)),
      ]);
      window.clearTimeout(slowPermission);
      mark('session + sdk ready');
      if (!session.success || !session.data) throw new Error(session.error?.message || 'VOICE_SESSION_FAILED');
      if (!vapi) throw new Error('VOICE_SDK_FAILED');
      sessionRef.current = { id: session.data.voiceSessionId, started: epochMs() };
      greetingRef.current = typeof session.data.assistant.firstMessage === 'string' ? session.data.assistant.firstMessage : null;
      conversationRef.current = session.data.conversationId;
      setConversationId(session.data.conversationId);
      setPhase('connecting');
      const slowHint = window.setTimeout(() => {
        if (phaseRef.current === 'connecting') setSlowConnect(true);
      }, SLOW_CONNECT_HINT_MS);
      const watchdog = window.setTimeout(() => {
        window.clearTimeout(slowHint);
        if (phaseRef.current === 'connecting') {
          void vapi.stop();
          setVoiceError(textsRef.current.timeout);
          setSlowConnect(false);
          setPhase('failed');
          void closeSession();
        }
      }, CONNECT_TIMEOUT_MS);
      const call = await vapi.start(session.data.assistant as never);
      if (!call && (phaseRef.current as Phase) === 'connecting') {
        window.clearTimeout(watchdog);
        window.clearTimeout(slowHint);
        throw new Error('VOICE_START_FAILED');
      }
    } catch (error) {
      window.clearTimeout(slowPermission);
      const name = (error as Error)?.name;
      setVoiceError(name === 'NotAllowedError' ? l.micDenied : name === 'NotFoundError' ? l.noMic : l.voiceFailed);
      setSlowConnect(false);
      setPhase('failed');
      void closeSession();
    }
  }

  function endCall() {
    void vapiRef.current?.stop();
    setPhase('ended');
    setPartial('');
  }

  function toggleMute() {
    const next = !muted;
    vapiRef.current?.setMuted(next);
    setMuted(next);
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || sending) return;
    setText('');
    // During a live call the question joins the voice conversation (Mitra answers aloud).
    if (phaseRef.current === 'live' && vapiRef.current) {
      vapiRef.current.send({ type: 'add-message', message: { role: 'user', content: q }, triggerResponseEnabled: true });
      beginVoiceTurn('farmer', q, 'text');
      flushVoiceTurn(); // typed text is complete: save it now, in order
      return;
    }
    const pendingId = uid();
    setMessages((prev) => [...prev, { id: uid(), role: 'farmer', text: q, channel: 'text' }, { id: pendingId, role: 'mitra', text: '', channel: 'text', pending: true }]);
    setSending(true);
    try {
      const res = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, diagnosisId, conversationId: conversationRef.current, turnId: `text-${epochMs().toString(36)}-${uid()}` }),
      });
      const body = (await res.json()) as {
        success: boolean;
        data?: { answer: string; sources: Source[]; conversationId: string; mode: AnswerMode };
        error?: { code?: string; details?: { conversationId?: string } };
      };
      const nextConversation = body.data?.conversationId ?? body.error?.details?.conversationId;
      if (nextConversation) {
        conversationRef.current = nextConversation;
        setConversationId(nextConversation);
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id !== pendingId
            ? m
            : body.success && body.data
              ? { ...m, pending: false, text: body.data.answer, sources: body.data.sources, mode: body.data.mode }
              : {
                  ...m,
                  pending: false,
                  error: body.error?.code === 'GENAI_NOT_CONFIGURED' ? 'config' : 'failed',
                  text: body.error?.code === 'GENAI_NOT_CONFIGURED' ? l.notConfigured : l.answerFailed,
                  retry: q,
                },
        ),
      );
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, pending: false, error: 'failed', text: l.answerFailed, retry: q } : m)));
    } finally {
      setSending(false);
    }
  }

  // A question chosen on the report page is asked once, then removed from the address bar.
  useEffect(() => {
    if (!initialQuestion || askedInitial.current) return;
    askedInitial.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    window.history.replaceState(null, '', url.pathname + url.search);
    void ask(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // "Ask Mitra" from a report: start the call automatically once the SDK is ready.
  const autoStarted = useRef(false);
  useEffect(() => {
    stopSpeaking();
    if (!autoVoice || autoStarted.current || !voiceAvailable) return;
    autoStarted.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('voice');
    window.history.replaceState(null, '', url.pathname + url.search);
    void (sdkReady.current ?? Promise.resolve(null)).then(() => startCall());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  async function updateConsent(change: { chatHistory?: boolean; voiceTranscripts?: boolean }) {
    const res = await fetch('/api/v1/assistant/consent', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { success?: boolean; data?: { chatHistory: boolean; voiceTranscripts: boolean } } | null;
    if (body?.success && body.data) setConsent({ chatHistory: body.data.chatHistory, voiceTranscripts: body.data.voiceTranscripts });
  }

  async function deleteHistory() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    const res = await fetch('/api/v1/assistant/conversations', { method: 'DELETE' }).catch(() => null);
    if (res?.ok) {
      setMessages([]);
      setConversationId(null);
      conversationRef.current = null;
    }
  }

  function retry(message: Message) {
    if (!message.retry) return;
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    void ask(message.retry);
  }

  function replay(say: string) {
    // Voice follows the script: Devanagari → Hindi voice, Roman Hinglish/English → Indian-English voice.
    void speakText(say);
  }


  const inCall = phase === 'live';
  const busy = phase === 'preparing' || phase === 'permission' || phase === 'connecting';
  const status =
    phase === 'live'
      ? muted
        ? l.muted
        : l[live]
      : phase === 'preparing'
        ? l.preparing
        : phase === 'permission'
          ? l.permission
          : phase === 'connecting'
            ? l.connecting
            : phase === 'ended'
              ? l.ended
              : phase === 'failed'
                ? l.failed
                : l.ready;
  const level = live === 'mitra' ? mitraLevel : muted ? 0 : micLevel;

  return (
    <div className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 pt-6 pb-6 sm:px-6 lg:px-8 lg:pt-10">
      {/* Intro — same type scale as the home page */}
      <PageIntro
        lang={lang}
        eyebrow={l.eyebrow}
        title={
          lang === 'hi' ? (
            <>
              <Accent>{displayName}</Accent> से बात करें
            </>
          ) : (
            <>
              {l.titleA} <Accent>{displayName}</Accent>
            </>
          )
        }
        description={l.tagline}
        actions={
          <span
            aria-live="polite"
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5',
              label,
              phase === 'live' ? 'bg-[var(--crop-green-100)] text-[var(--crop-green-900)]' : phase === 'failed' ? 'bg-red-50 text-red-700' : busy ? 'bg-amber-50 text-amber-800' : 'bg-white text-foreground/60 ring-1 ring-border',
            )}
          >
            <span className={cn('size-1.5 rounded-full', phase === 'live' ? 'bg-[var(--crop-green-600)]' : phase === 'failed' ? 'bg-red-500' : busy ? 'animate-pulse bg-amber-500 motion-reduce:animate-none' : 'bg-foreground/30')} />
            {phase === 'live' ? l.live : status}
          </span>
        }
      />

      {/* Desktop: both columns share one height (fills the screen) so their edges line up. */}
      {/* Fixed height on desktop (NOT flex-1: a flex item's min-height:auto would let the chat
          content stretch the grid). Messages scroll inside the conversation panel like a chat app. */}
      <div className="grid gap-5 lg:h-[clamp(37rem,calc(100dvh-18.5rem),54rem)] lg:min-h-0 lg:flex-none lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)] lg:gap-6">
        {/* Voice — photo panel like the home hero */}
        <section aria-label={l.voice} className="flex flex-col lg:col-span-5 lg:min-h-0">
          <div className="relative flex-1 overflow-hidden rounded-[28px] bg-[var(--crop-green-950)] text-white lg:min-h-0">
            <Image src="/images/home/field-band.jpg" alt="" fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover object-[50%_40%]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[var(--crop-green-950)]/60 to-[var(--crop-green-950)]/95" />
            <div className="relative flex min-h-[30rem] flex-col justify-between gap-5 p-5 sm:min-h-[33rem] sm:p-7 lg:h-full lg:min-h-0">
              <div className="flex items-start justify-between">
                <span className="flex items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
                  <LeafMark className="size-5 text-[var(--crop-green-200)]" />
                  {displayName.toUpperCase()}
                </span>
                <span className={cn(label, 'rounded-full border border-white/30 px-3 py-1 backdrop-blur-md')}>{inCall ? l.live : l.voice}</span>
              </div>

              {/* The report Mitra talks about (glass strip, like the home hero chips) */}
              {report ? (
                <Link
                  href={`/farmer/diagnosis/${report.id}`}
                  className="group -mt-1 flex items-center gap-3 rounded-2xl bg-white/12 p-2 pr-3 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/20"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- private authenticated image route */}
                  <img src={`/api/v1/images/diagnoses/${report.id}`} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className={cn(label, 'block text-[var(--crop-green-200)]')}>{l.report}</span>
                    <span className="block truncate text-sm font-semibold">
                      {report.crop} · {report.condition}
                      <span className="font-normal text-white/60"> · {report.date}</span>
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              ) : (
                <Link
                  href="/farmer/scan"
                  className="group -mt-1 flex items-center gap-3 rounded-2xl bg-white/12 p-2 pr-3 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/20"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15">
                    <FileText className="size-5" strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-white/85">{l.noReport}</span>
                  <ArrowUpRight className="size-4 shrink-0 text-white/70" />
                </Link>
              )}

              <div className="flex flex-col items-center gap-4 text-center">
                <button
                  type="button"
                  onClick={inCall ? endCall : startCall}
                  disabled={!voiceAvailable || busy}
                  aria-label={inCall ? l.end : l.tap}
                  className="relative grid size-28 place-items-center rounded-full sm:size-32 bg-white text-[var(--crop-green-900)] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)] transition-transform hover:scale-[1.03] active:scale-95 disabled:cursor-wait disabled:opacity-80"
                >
                  {(inCall || busy) && (
                    <span
                      aria-hidden
                      className="absolute -inset-3 rounded-full border border-white/40 transition-transform duration-100 motion-reduce:transition-none"
                      style={{ transform: `scale(${1 + Math.min(0.22, level * 0.6)})` }}
                    />
                  )}
                  {busy ? <Loader2 className="size-11 animate-spin" /> : inCall ? <PhoneOff className="size-11" /> : <Mic className="size-12" strokeWidth={1.8} />}
                </button>
                <div className="flex min-h-14 w-full items-center justify-center">
                  {inCall &&
                    (live === 'processing' ? (
                      <span className="flex items-center gap-2 text-sm text-white/80">
                        <Loader2 className="size-4 animate-spin" /> {l.processing}
                      </span>
                    ) : (
                      <LiveWaveform level={level} tone={live === 'mitra' ? 'mitra' : 'farmer'} label={live === 'mitra' ? l.mitra : l.farmer} light />
                    ))}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-lg font-semibold sm:text-xl" aria-live="polite">
                    {inCall || busy || phase === 'failed' ? status : phase === 'ended' ? l.tapAgain : voiceAvailable ? l.tap : l.voiceFailed}
                  </p>
                  {slowConnect && busy && <p className="max-w-xs text-xs text-white/75">{l.slow}</p>}
                  {connectSeconds && inCall && <p className={cn(label, 'text-white/60')}>{l.connectedIn(connectSeconds)}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {voiceError && (
                  <p role="alert" className="flex items-start gap-2 rounded-2xl bg-white/12 px-4 py-3 text-sm text-white backdrop-blur-md ring-1 ring-white/20">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" /> {voiceError}
                  </p>
                )}
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex gap-2.5">
                    <div className="flex size-[78px] flex-col justify-between rounded-2xl bg-[var(--crop-ink)]/80 p-3 backdrop-blur-md">
                      <span className="text-lg leading-none font-semibold tracking-tight">हिं·EN</span>
                      <span className="text-[9px] leading-tight font-semibold tracking-[0.14em] uppercase opacity-80">{l.languages}</span>
                    </div>
                    <div className="flex size-[78px] flex-col justify-between rounded-2xl bg-white/95 p-3 text-[var(--crop-ink)]">
                      <span className="text-2xl leading-none font-semibold tracking-tight">0</span>
                      <span className="text-[9px] leading-tight font-semibold tracking-[0.14em] uppercase opacity-70">{l.audioStored}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {inCall ? (
                      <>
                        <button type="button" onClick={toggleMute} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/35 px-4 text-[11px] font-semibold tracking-[0.12em] uppercase backdrop-blur-md transition-colors hover:bg-white/10">
                          {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />} {muted ? l.unmute : l.mute}
                        </button>
                        <button type="button" onClick={endCall} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-[11px] font-semibold tracking-[0.12em] text-red-700 uppercase transition-colors hover:bg-red-50">
                          <PhoneOff className="size-4" /> {l.end}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={startCall}
                        disabled={!voiceAvailable || busy}
                        className="group inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-[11px] font-semibold tracking-[0.12em] text-[var(--crop-ink)] uppercase shadow-lg transition-colors hover:bg-[var(--crop-green-100)] disabled:opacity-70"
                      >
                        {phase === 'failed' ? <RotateCcw className="size-4" /> : null}
                        {phase === 'failed' ? l.retry : l.start}
                        <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-white/60">{l.privacy}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Conversation */}
        <section aria-label={l.conversation} className="relative flex h-[min(40rem,82dvh)] min-h-0 flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-border lg:col-span-7 lg:h-full">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-5 py-3 sm:px-6">
            <span className={cn(label, 'text-[11px] text-foreground/70')}>{l.conversation}</span>
            <div className="flex items-center gap-1">
              <Link href="/farmer/settings" aria-label={l.settings} className={cn(label, 'flex h-9 items-center gap-1.5 rounded-xl px-2.5 hover:bg-muted')}>
                <Settings2 className="size-3.5" /> <span className="hidden sm:inline">{l.settings}</span>
              </Link>
              <Link href="/farmer/assistant?new=1" className={cn(label, 'flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[var(--crop-green-800)] hover:bg-[var(--crop-green-100)]')}>
                <Plus className="size-3.5" /> {l.newChat}
              </Link>
              <Popover>
                <PopoverTrigger className={cn(label, 'flex h-9 items-center gap-1.5 rounded-xl px-2.5 hover:bg-muted')}>
                  <History className="size-3.5" /> {l.history}
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[9px]', consent.chatHistory ? 'bg-[var(--crop-green-100)] text-[var(--crop-green-900)]' : 'bg-muted text-muted-foreground')}>
                    {consent.chatHistory ? l.saved : l.notSaved}
                  </span>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <div className="flex flex-col gap-3 text-sm">
                    <label className="flex items-start justify-between gap-3">
                      <span>{l.saveChats}</span>
                      <Switch checked={consent.chatHistory} onCheckedChange={(v) => void updateConsent({ chatHistory: Boolean(v) })} />
                    </label>
                    <label className="flex items-start justify-between gap-3">
                      <span>{l.saveVoice}</span>
                      <Switch checked={consent.voiceTranscripts} onCheckedChange={(v) => void updateConsent({ voiceTranscripts: Boolean(v) })} />
                    </label>
                    <p className="text-xs text-muted-foreground">{l.consentNote}</p>
                    {savedConversations.length > 0 && (
                      <div className="flex flex-col gap-1 border-t border-border/70 pt-3">
                        <span className="text-xs font-semibold text-muted-foreground">{l.earlier}</span>
                        {savedConversations.slice(0, 6).map((c) => (
                          <Link key={c.id} href={`/farmer/assistant?c=${c.id}`} className={cn('truncate rounded-lg px-2 py-1.5 hover:bg-muted', c.id === conversationId && 'bg-[var(--crop-green-100)]')}>
                            {c.title}
                          </Link>
                        ))}
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="justify-start text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => void deleteHistory()}>
                      <Trash2 /> {confirmingDelete ? l.confirmDelete : l.deleteHistory}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div ref={scrollRef} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain scroll-smooth px-4 py-5 [scrollbar-width:thin] sm:px-6">
            {messages.length === 0 && !partial ? (
              <div className="my-auto flex flex-col gap-6 py-4">
                <div>
                  <p className={cn(label, 'text-[var(--crop-green-600)]')}>{l.emptyEyebrow}</p>
                  <h2 className="mt-2 text-[clamp(1.9rem,3.6vw,3rem)] leading-[0.95] font-semibold tracking-[-0.04em] uppercase">
                    {l.emptyTitleA} <span className="text-[var(--crop-green-500)]">{l.emptyTitleB}</span>
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{l.empty}</p>
                </div>
                <ul className="grid gap-px overflow-hidden rounded-2xl bg-border/70 sm:grid-cols-2">
                  {l.suggestions.map((s, i) => {
                    const Icon = SUGGESTION_ICONS[i];
                    return (
                      <li key={s.title}>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => void ask(s.title)}
                          className="group flex h-full w-full flex-col gap-3 bg-[var(--crop-cream)] p-5 text-left transition-colors hover:bg-[var(--crop-green-100)] disabled:opacity-60"
                        >
                          <span className="flex items-center justify-between">
                            <span className="grid size-10 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)] transition-transform duration-500 group-hover:-rotate-6 group-hover:bg-white">
                              <Icon className="size-5" strokeWidth={1.7} />
                            </span>
                            <span className={cn(label, 'text-[var(--crop-green-600)]')}>{s.tag}</span>
                          </span>
                          <span className="text-sm font-semibold tracking-tight sm:text-base">{s.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              messages.map((m) =>
                m.role === 'farmer' ? (
                  <div key={m.id} className="flex max-w-[86%] flex-col items-end gap-1 self-end">
                    <div className="rounded-2xl rounded-br-md bg-[var(--crop-green-800)] px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-white">{m.text}</div>
                    {m.channel === 'voice' && (
                      <span className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                        <Mic className="size-3" /> {l.you}
                      </span>
                    )}
                  </div>
                ) : (
                  <div key={m.id} className="flex max-w-[92%] gap-2.5 self-start">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--crop-green-100)]">
                      <LeafMark className="size-4 text-[var(--crop-green-600)]" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div
                        className={cn(
                          'rounded-2xl rounded-tl-md px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line',
                          m.error ? 'bg-amber-50 text-amber-950 ring-1 ring-amber-200' : 'bg-[var(--crop-cream)] ring-1 ring-border',
                        )}
                      >
                        {m.pending ? (
                          <span className="flex items-center gap-1.5 py-1" aria-label={l.processing}>
                            {[0, 1, 2].map((i) => (
                              <span key={i} className="size-1.5 animate-bounce rounded-full bg-foreground/40 motion-reduce:animate-none" style={{ animationDelay: `${i * 120}ms` }} />
                            ))}
                          </span>
                        ) : (
                          m.text
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground">
                        {m.channel === 'voice' && <Mic className="size-3" />}
                        {m.mode && l.modes[m.mode] && <span className={cn(label, 'text-[9px]', m.mode === 'web' ? 'text-amber-700' : 'text-[var(--crop-green-600)]')}>{l.modes[m.mode]}</span>}
                        {!m.pending && !m.error && (
                          <button type="button" onClick={() => replay(m.text)} className="flex items-center gap-1 font-medium text-[var(--crop-green-800)] hover:underline">
                            <Volume2 className="size-3" /> {l.replay}
                          </button>
                        )}
                        {m.error && m.retry && (
                          <button type="button" onClick={() => retry(m)} className="flex items-center gap-1 font-medium text-[var(--crop-green-800)] hover:underline">
                            <RotateCcw className="size-3" /> {l.retry}
                          </button>
                        )}
                      </div>
                      {m.sources && m.sources.length > 0 && (
                        <div className="flex flex-col gap-1 rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-border">
                          <span className={cn(label, 'text-[9px] text-muted-foreground')}>{l.sources}</span>
                          {m.sources.map((s) => (
                            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1.5 text-[var(--crop-green-800)] hover:underline">
                              <Globe className="size-3 shrink-0" />
                              <span className="truncate">
                                {s.site} — {s.title}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )
            )}
            {partial && (
              <div className="flex max-w-[86%] flex-col items-end gap-1 self-end">
                <div className="rounded-2xl rounded-br-md border border-dashed border-[var(--crop-green-600)] bg-[var(--crop-green-100)] px-4 py-3 text-[15px] text-[var(--crop-green-900)]">{partial}</div>
                <span className="px-1 text-[11px] text-muted-foreground">
                  {l.you} · {l.farmer}
                </span>
              </div>
            )}
          </div>

          {showLatest && (
            <div className="pointer-events-none relative">
              <button
                type="button"
                onClick={() => scrollToLatest()}
                className={cn(label, 'pointer-events-auto absolute -top-14 left-1/2 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--crop-ink)] px-4 text-white shadow-lg transition-transform hover:-translate-y-0.5')}
              >
                <ArrowDown className="size-3.5" /> {l.latest}
              </button>
            </div>
          )}
          <div className="border-t border-border/70 bg-white px-4 py-3 sm:px-6">
            {messages.length > 0 && (
              <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {l.suggestions.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    disabled={sending}
                    onClick={() => void ask(s.title)}
                    className="shrink-0 rounded-full bg-[var(--crop-cream)] px-3 py-1.5 text-xs font-medium ring-1 ring-border transition-colors hover:bg-[var(--crop-green-100)] disabled:opacity-50"
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(text);
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={inCall ? l.sendDuringCall : l.placeholder}
                maxLength={500}
                aria-label={l.placeholder}
                className="h-12 min-w-0 flex-1 rounded-2xl bg-[var(--crop-cream)] px-4 text-[15px] ring-1 ring-border outline-none focus:ring-2 focus:ring-[var(--crop-green-500)]"
              />
              <Button type="submit" className="size-12 rounded-2xl" disabled={sending || !text.trim()} aria-label="Send">
                {sending ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
