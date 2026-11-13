'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts';
import { Download, MessageCircle, Share2, ThumbsDown, ThumbsUp, UserRoundCheck, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';

const chartConfig = { score: { label: 'Model score', color: 'var(--crop-green-600)' } } satisfies ChartConfig;

/** Top-k model scores (actual inference output). */
export function ScoreChart({ data }: { data: { name: string; score: number; top: boolean }[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 44, top: 4, bottom: 4 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis type="category" dataKey="name" width={118} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <Bar dataKey="score" radius={8} fill="var(--color-score)" fillOpacity={0.9}>
          <LabelList dataKey="score" position="right" formatter={(v: unknown) => `${v}%`} className="fill-foreground text-xs font-semibold" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

const L = {
  hi: { listen: 'सुनें', stop: 'रोकें', ask: 'मित्र से पूछें', share: 'शेयर', download: 'डाउनलोड', expert: 'विशेषज्ञ से जांच', expertSent: 'विशेषज्ञ को भेजा गया', helpful: 'क्या यह रिपोर्ट मददगार थी?', yes: 'हाँ', no: 'नहीं', thanks: 'धन्यवाद! आपकी राय सेव हो गई।', copied: 'रिपोर्ट का सारांश कॉपी हो गया' },
  en: { listen: 'Listen', stop: 'Stop', ask: 'Ask Mitra', share: 'Share', download: 'Download', expert: 'Ask an expert', expertSent: 'Sent to expert', helpful: 'Was this report helpful?', yes: 'Yes', no: 'No', thanks: 'Thank you! Your feedback is saved.', copied: 'Report summary copied' },
};

export function ReportActions({ id, lang, speech, shareText, reviewStatus, feedback }: {
  id: string;
  lang: string;
  speech: string;
  shareText: string;
  reviewStatus: string;
  feedback: boolean | null;
}) {
  const l = lang === 'en' ? L.en : L.hi;
  const [speaking, setSpeaking] = useState(false);
  const [review, setReview] = useState(reviewStatus);
  const [helpful, setHelpful] = useState<boolean | null>(feedback);

  function listen() {
    if (!('speechSynthesis' in window)) return toast.error('Voice not supported on this phone');
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(speech);
    u.lang = lang === 'en' ? 'en-IN' : 'hi-IN';
    u.rate = 0.9;
    u.onend = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
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
    <div className="flex flex-col gap-3 print:hidden">
      <div className="grid grid-cols-2 gap-2.5">
        <Button className="h-14 rounded-2xl text-base" onClick={listen}>{speaking ? <VolumeX /> : <Volume2 />} {speaking ? l.stop : l.listen}</Button>
        <Link href={`/farmer/assistant?diagnosis=${id}`} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--crop-green-100)] text-base font-medium text-[var(--crop-green-900)]">
          <MessageCircle className="size-5" /> {l.ask}
        </Link>
        <Button variant="outline" className="h-12 rounded-2xl bg-white" onClick={share}><Share2 /> {l.share}</Button>
        <Button variant="outline" className="h-12 rounded-2xl bg-white" onClick={() => window.print()}><Download /> {l.download}</Button>
      </div>
      <Button
        variant="outline"
        className="h-13 rounded-2xl bg-white text-base"
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
      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-border">
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
