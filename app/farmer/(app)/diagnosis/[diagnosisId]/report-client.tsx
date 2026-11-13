'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, Cell, ComposedChart, LabelList, Line, PolarAngleAxis, RadialBar, RadialBarChart, XAxis, YAxis } from 'recharts';
import { Download, MessageCircle, Share2, ThumbsDown, ThumbsUp, UserRoundCheck, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { canSpeak, speakText, stopSpeaking } from '@/lib/voice/speak';

const chartConfig = { score: { label: 'Model score', color: 'var(--crop-green-600)' } } satisfies ChartConfig;

/** Top-k model scores (actual inference output); the top guess is highlighted. */
export function ScoreChart({ data }: { data: { name: string; score: number; top: boolean }[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height: Math.max(120, data.length * 44) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 48, top: 0, bottom: 0 }} barCategoryGap={10}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis type="category" dataKey="name" width={124} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <Bar dataKey="score" radius={10} background={{ fill: 'var(--crop-cream)', radius: 10 }}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.top ? 'var(--crop-green-800)' : 'var(--crop-green-200)'} />
          ))}
          <LabelList dataKey="score" position="right" formatter={(v: unknown) => `${v}%`} className="fill-foreground text-xs font-semibold" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Semicircle gauge for the model score (a classifier output, not certainty). */
export function ScoreGauge({ score, healthy, label }: { score: number; healthy: boolean; label: string }) {
  const color = healthy ? 'var(--crop-green-600)' : score >= 70 ? '#c2410c' : '#d97706';
  return (
    <div className="relative mx-auto w-full max-w-[15rem]">
      <ChartContainer config={chartConfig} className="aspect-[2/1.15] w-full">
        <RadialBarChart data={[{ name: 'score', value: score, fill: color }]} startAngle={180} endAngle={0} cx="50%" cy="88%" innerRadius="118%" outerRadius="160%">
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar dataKey="value" background={{ fill: 'var(--crop-cream)' }} cornerRadius={14} />
        </RadialBarChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center">
        <span className="text-4xl leading-none font-semibold tracking-tight tabular-nums">{score}%</span>
        <span className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</span>
      </div>
    </div>
  );
}

const forecastConfig = {
  rain: { label: 'Rain (mm)', color: 'var(--crop-green-200)' },
  max: { label: 'Max °C', color: '#c2410c' },
} satisfies ChartConfig;

/** Next days: rain bars + max temperature line (Open-Meteo forecast stored with the report). */
export function ForecastChart({ data }: { data: { day: string; max: number | null; min: number | null; rain: number }[] }) {
  return (
    <ChartContainer config={forecastConfig} className="aspect-auto h-[150px] w-full">
      <ComposedChart data={data} margin={{ left: 4, right: 4, top: 22, bottom: 0 }}>
        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="rain" hide domain={[0, (max: number) => Math.max(10, max * 1.4)]} />
        <YAxis yAxisId="temp" hide domain={['dataMin - 8', 'dataMax + 4']} />
        <Bar yAxisId="rain" dataKey="rain" fill="var(--color-rain)" radius={8} barSize={26}>
          <LabelList dataKey="rain" position="insideBottom" formatter={(v: unknown) => `${v}`} className="fill-[var(--crop-green-900)] text-[10px] font-semibold" />
        </Bar>
        <Line yAxisId="temp" dataKey="max" stroke="var(--color-max)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}>
          <LabelList dataKey="max" position="top" formatter={(v: unknown) => (v == null ? '' : `${v}°`)} className="fill-foreground text-[10px] font-semibold" />
        </Line>
      </ComposedChart>
    </ChartContainer>
  );
}

const L = {
  hi: { listen: 'सुनें', stop: 'रोकें', ask: 'मित्र से पूछें', share: 'शेयर', download: 'डाउनलोड', expert: 'विशेषज्ञ से जांच', expertSent: 'विशेषज्ञ को भेजा गया', helpful: 'क्या यह रिपोर्ट मददगार थी?', yes: 'हाँ', no: 'नहीं', thanks: 'धन्यवाद! आपकी राय सेव हो गई।', copied: 'रिपोर्ट का सारांश कॉपी हो गया' },
  en: { listen: 'Listen', stop: 'Stop', ask: 'Ask Mitra', share: 'Share', download: 'Download', expert: 'Ask an expert', expertSent: 'Sent to expert', helpful: 'Was this report helpful?', yes: 'Yes', no: 'No', thanks: 'Thank you! Your feedback is saved.', copied: 'Report summary copied' },
};

export function ReportActions({ id, lang, speech, speechFallback, shareText, reviewStatus, feedback }: {
  id: string;
  lang: string;
  /** spoken script in the farmer's Mitra language (Hinglish by default) */
  speech: string;
  /** Roman-script version for devices without a Hindi voice */
  speechFallback?: string;
  shareText: string;
  reviewStatus: string;
  feedback: boolean | null;
}) {
  const l = lang === 'en' ? L.en : L.hi;
  const [speaking, setSpeaking] = useState(false);
  const [review, setReview] = useState(reviewStatus);
  const [helpful, setHelpful] = useState<boolean | null>(feedback);
  // Never keep reading after the farmer leaves the report (e.g. to talk to Mitra).
  useEffect(() => () => stopSpeaking(), []);

  function listen() {
    if (!canSpeak()) return toast.error('Voice not supported on this phone');
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    void speakText(speech, { fallback: speechFallback, rate: 0.92, onEnd: () => setSpeaking(false) });
  }

  async function act(body: Record<string, unknown>) {
    const res = await fetch(`/api/v1/farmer/diagnoses/${id}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return (await res.json()) as { success: boolean; data?: { status?: string }; error?: { message: string } };
  }

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: 'Crop report', text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        toast.success(l.copied);
      }
    } catch {}
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] print:hidden">
      <div className="contents">
        <Button className="h-12 rounded-2xl text-base" onClick={listen}>{speaking ? <VolumeX /> : <Volume2 />} {speaking ? l.stop : l.listen}</Button>
        <Link href={`/farmer/assistant?diagnosis=${id}&voice=1`} onClick={() => stopSpeaking()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--crop-green-100)] text-base font-medium text-[var(--crop-green-900)] transition-colors hover:bg-[var(--crop-green-200)]">
          <MessageCircle className="size-5" /> {l.ask}
        </Link>
        <Button variant="outline" className="h-12 rounded-2xl bg-white" onClick={share}><Share2 /> {l.share}</Button>
        <Button variant="outline" className="h-12 rounded-2xl bg-white" onClick={() => window.print()}><Download /> {l.download}</Button>
      </div>
      <Button
        variant="outline"
        className="col-span-2 h-12 rounded-2xl bg-white text-base lg:col-span-1"
        disabled={review === 'PENDING' || review === 'CONFIRMED' || review === 'CHALLENGED'}
        onClick={async () => {
          const res = await act({ action: 'request_expert' });
          if (res.success) {
            setReview(res.data?.status ?? 'PENDING');
            toast.success(l.expertSent);
          } else toast.error(res.error?.message ?? 'Error');
        }}
      >
        <UserRoundCheck /> {review === 'PENDING' ? l.expertSent : l.expert}
      </Button>
      <div className="col-span-2 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-1.5 ring-1 ring-border lg:col-span-1">
        <span className="text-sm font-medium">{helpful === null ? l.helpful : l.thanks}</span>
        <div className="flex gap-2">
          {[true, false].map((value) => (
            <Button
              key={String(value)}
              size="icon-lg"
              variant={helpful === value ? 'default' : 'outline'}
              className="rounded-xl"
              aria-label={value ? l.yes : l.no}
              onClick={async () => {
                const res = await act({ action: 'feedback', helpful: value });
                if (res.success) setHelpful(value);
              }}
            >
              {value ? <ThumbsUp /> : <ThumbsDown />}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
