import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cropName, splitLabel } from '@/lib/crops';
import { requireStaff } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { can } from '@/server/auth/rbac';
import { tryGetTaxonomy } from '@/server/cropai/taxonomy';
import { db } from '@/server/db';
import { fmtDate, PageHeader, pct, ReviewBadge } from '../../ui';
import { ReviewForm } from './review-form';

export const metadata = { title: 'Diagnosis' };

export default async function AdminDiagnosisPage({ params }: { params: Promise<{ diagnosisId: string }> }) {
  const staff = await requireStaff('diagnoses:view');
  const { diagnosisId } = await params;
  const d = await db.diagnosis.findUnique({
    where: { id: diagnosisId },
    include: {
      predictions: { orderBy: { rank: 'asc' } },
      weather: true,
      knowledge: { select: { id: true, title: true, status: true } },
      reviews: { orderBy: { createdAt: 'desc' }, include: { reviewer: { select: { name: true, email: true } } } },
      feedback: true,
      farmer: { select: { id: true, phone: true, farmerProfile: { select: { preferredName: true, district: true, state: true } } } },
    },
  });
  if (!d) notFound();
  const taxonomy = await tryGetTaxonomy();
  const crop = taxonomy?.crops.find((c) => c.id === d.predictedCrop);
  const raw = d.rawOutput as { imageQuality?: { width: number; height: number; brightness: number; sharpness: number; warnings: { code: string; message: string }[] }; globalTop?: { label: string; rawScore: number } };
  const advisories = d.advisories as { code: string; message: string; basis: string }[];

  return (
    <>
      <Link href="/admin/diagnoses" className="mb-3 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Diagnoses</Link>
      <PageHeader title={`${cropName(d.predictedCrop)} · ${d.predictedCondition}`} description={`${fmtDate(d.createdAt)} · ${d.id}`} actions={<ReviewBadge status={d.reviewStatus} />} />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden rounded-2xl py-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- authorised private image */}
            <img src={`/api/v1/images/diagnoses/${d.id}`} alt="Farmer photo" className="max-h-[460px] w-full bg-black/5 object-contain" />
          </Card>
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Model output (original)</CardTitle><CardDescription>{d.modelName} {d.modelVersion} · sha256 {d.modelSha256.slice(0, 12)}… · {d.scoreType}</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {d.predictions.map((p) => (
                <div key={p.id} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm"><span className={p.rank === 1 ? 'font-semibold' : ''}>{p.rank}. {splitLabel(p.label).condition}</span><span className="tabular-nums text-muted-foreground">{pct(p.score)} <span className="text-xs">(raw {pct(p.rawScore)})</span></span></div>
                  <Progress value={p.score * 100} />
                </div>
              ))}
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Selected crop</dt><dd>{d.selectedCrop ? cropName(d.selectedCrop) : 'auto'}</dd>
                <dt className="text-muted-foreground">Global top class</dt><dd>{d.globalTopLabel} ({pct(d.globalTopScore)})</dd>
                <dt className="text-muted-foreground">Margin top-1/top-2</dt><dd>{pct(d.margin)}</dd>
                <dt className="text-muted-foreground">Inference / total</dt><dd>{d.inferenceMs} ms / {d.latencyMs} ms</dd>
                <dt className="text-muted-foreground">Photo</dt><dd>{raw.imageQuality ? `${raw.imageQuality.width}×${raw.imageQuality.height}, sharpness ${raw.imageQuality.sharpness}` : '—'}</dd>
                <dt className="text-muted-foreground">Explanation</dt><dd>{d.explanationSource ?? '—'}{d.knowledge ? ` · KB: ${d.knowledge.title}` : ''}</dd>
              </dl>
              {advisories.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {advisories.map((a) => <li key={a.code} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><b>{a.code}</b> ({a.basis}) — {a.message}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Farmer</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p>{d.farmer.farmerProfile?.preferredName ?? 'No name given'} · {maskPhone(d.farmer.phone)}</p>
              <p className="text-muted-foreground">{[d.farmer.farmerProfile?.district, d.farmer.farmerProfile?.state].filter(Boolean).join(', ') || 'Location not shared'}</p>
              {can(staff.role, 'farmers:view') && <Link className="mt-2 inline-block text-[var(--crop-green-800)] underline" href={`/admin/farmers/${d.farmer.id}`}>Farmer record</Link>}
              {d.feedback[0] && <p className="mt-2">Farmer feedback: <Badge variant="outline">{d.feedback[0].helpful ? 'helpful' : 'not helpful'}</Badge> {d.feedback[0].comment}</p>}
              {d.weather && <p className="mt-2 text-muted-foreground">Weather at check: {d.weather.temperatureC}°C, {d.weather.humidityPct}% RH, rain 24 h {d.weather.rainLast24hMm} mm (Open-Meteo)</p>}
            </CardContent>
          </Card>

          {can(staff.role, 'reviews:write') && (
            <Card className="rounded-2xl">
              <CardHeader><CardTitle>Expert review</CardTitle><CardDescription>Stored separately — the model output above is never changed.</CardDescription></CardHeader>
              <CardContent><ReviewForm diagnosisId={d.id} classes={(crop?.classes ?? []).map((c) => ({ label: c.label, name: c.name }))} /></CardContent>
            </Card>
          )}

          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Review history</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {d.reviews.length === 0 ? <p className="text-muted-foreground">No reviews yet.</p> : d.reviews.map((r) => (
                <div key={r.id} className="rounded-lg bg-muted px-3 py-2">
                  <p className="flex items-center justify-between"><b>{r.verdict}</b><span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)} · {r.reviewer.name ?? r.reviewer.email}</span></p>
                  {r.correctedLabel && <p className="text-xs">Expert condition: {splitLabel(r.correctedLabel).condition}</p>}
                  <p>{r.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
