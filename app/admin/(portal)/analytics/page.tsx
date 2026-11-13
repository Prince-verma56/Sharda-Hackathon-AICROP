import Link from 'next/link';
import { Activity, AlertTriangle, Clock, Mic, ScanSearch, Users } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cropName, splitLabel } from '@/lib/crops';
import { cn } from '@/lib/utils';
import { getAnalytics } from '@/server/admin/queries';
import { requireStaff } from '@/server/auth/dal';
import { EmptyState, PageHeader, pct, StatCard } from '../ui';
import { DailyChart, DonutChart, HBarChart } from './charts';

export const metadata = { title: 'Analytics' };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireStaff('analytics:view');
  const requested = Number((await searchParams).days);
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  const a = await getAnalytics(days);
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Aggregated from real platform records. Model scores are classifier outputs, not field accuracy."
        actions={[7, 30, 90].map((d) => (
          <Link key={d} href={`?days=${d}`} className={cn(buttonVariants({ variant: d === days ? 'default' : 'outline', size: 'sm' }), d !== days && 'bg-white')}>{d} days</Link>
        ))}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Diagnoses" value={a.total} icon={ScanSearch} />
        <StatCard label="Active farmers" value={a.activeFarmers} hint={a.perFarmer != null ? `${a.perFarmer.toFixed(1)} checks each` : undefined} icon={Users} />
        <StatCard label="Uncertain rate" value={pct(a.uncertainRate)} hint="results with model advisories" icon={AlertTriangle} />
        <StatCard label="Avg model score" value={pct(a.avgScore)} icon={Activity} />
        <StatCard label="Avg inference" value={a.avgInferenceMs != null ? `${Math.round(a.avgInferenceMs)} ms` : '—'} hint={a.avgLatencyMs != null ? `${Math.round(a.avgLatencyMs)} ms end-to-end` : undefined} icon={Clock} />
        <StatCard label="Voice sessions" value={a.voiceSessions} hint={a.voiceAvgSeconds != null ? `avg ${a.voiceAvgSeconds}s` : 'no completed calls'} icon={Mic} />
      </div>
      {a.total === 0 ? (
        <div className="mt-6"><EmptyState title={`No diagnoses in the last ${days} days`} text="Charts appear once farmers check crops. No placeholder data is shown." /></div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <Card className="rounded-2xl xl:col-span-2"><CardHeader><CardTitle>Diagnoses per day</CardTitle></CardHeader><CardContent><DailyChart data={a.series} /></CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle>Top crops</CardTitle></CardHeader><CardContent><HBarChart label="Diagnoses" data={a.crops.map((c) => ({ name: cropName(c.crop), count: c.count }))} /></CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle>Top predicted conditions</CardTitle></CardHeader><CardContent><HBarChart label="Diagnoses" data={a.conditions.map((c) => ({ name: `${cropName(splitLabel(c.label).crop)} · ${splitLabel(c.label).condition}`.slice(0, 32), count: c.count }))} /></CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle>Review status</CardTitle></CardHeader><CardContent className="flex justify-center"><DonutChart data={a.reviews.map((r) => ({ name: r.status.toLowerCase(), count: r.count }))} /></CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle>Explanation source</CardTitle><CardDescription>llm = GenAI passed guardrails · approved_guidance = expert text · none = no approved guidance yet</CardDescription></CardHeader><CardContent className="flex justify-center"><DonutChart data={a.explanationSources.map((e) => ({ name: e.source, count: e.count }))} /></CardContent></Card>
        </div>
      )}
    </>
  );
}
