import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageIntro } from '@/components/marketing/site-chrome';
import metrics from '@/ai/models/agrismart-india/metrics.json';

export const metadata = { title: 'Model insights' };

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function InsightsPage() {
  const d = metrics.test_by_domain;
  const rows = [
    { set: 'Lab photos (PlantVillage)', n: d.lab.test_images, f1: d.lab.macro_f1, acc: d.lab.accuracy, crop: d.lab.crop_given.accuracy },
    { set: 'Research datasets (mostly field)', n: d.mixed.test_images, f1: d.mixed.macro_f1, acc: d.mixed.accuracy, crop: d.mixed.crop_given.accuracy },
    { set: 'Field photos (PlantWild)', n: d.field.test_images, f1: d.field.macro_f1, acc: d.field.accuracy, crop: d.field.crop_given.accuracy },
    { set: 'All clean test photos', n: metrics.test_clean.test_images, f1: metrics.test_clean.macro_f1, acc: metrics.test_clean.accuracy, crop: metrics.test_clean.crop_given.accuracy },
  ];
  return (
    <>
      <PageIntro eyebrow="Insights" title="How accurate is the screening?" text="These are the model authors’ held-out test results. Lab photos are easy; real field photos are much harder — so we always show results as a screening, not a diagnosis." />
      <section className="mx-auto grid max-w-[88rem] gap-4 px-4 pb-16 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:px-8">
        <Card data-reveal className="rounded-3xl">
          <CardHeader><CardTitle>Accuracy by photo type</CardTitle><CardDescription>AgriSmart India v1 · 59 crops · 387 classes · upstream test set (28,328 photos)</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-5">
            {rows.map((r) => (
              <div key={r.set} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm"><span className="font-medium">{r.set}</span><span className="text-muted-foreground">{r.n.toLocaleString('en-IN')} photos</span></div>
                <div className="flex items-center gap-3">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[var(--crop-green-300,#9cc47e)]" style={{ width: pct(r.acc) }} /></div>
                  <span className="w-14 text-right text-sm tabular-nums">{pct(r.acc)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[var(--crop-green-600)]" style={{ width: pct(r.crop) }} /></div>
                  <span className="w-14 text-right text-sm font-semibold tabular-nums">{pct(r.crop)}</span>
                </div>
              </div>
            ))}
            <p className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#9cc47e]" /> no crop chosen</span><span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[var(--crop-green-600)]" /> crop chosen by farmer</span></p>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card data-reveal className="rounded-3xl">
            <CardHeader><CardTitle>What this means</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
              <p><b className="text-foreground">Choose the crop.</b> On field photos accuracy rises from {pct(d.field.accuracy)} to {pct(d.field.crop_given.accuracy)} when the farmer selects the crop — so the app always asks.</p>
              <p><b className="text-foreground">Field is harder than lab.</b> Expect roughly 8–9 in 10 correct on real farm photos with the crop chosen, versus over 99% on clean lab photos.</p>
              <p><b className="text-foreground">Not every photo works.</b> The model has no “not a plant” detector; unclear photos are flagged and sent for expert review.</p>
            </CardContent>
          </Card>
          <Card data-reveal className="rounded-3xl">
            <CardHeader><CardTitle>Macro-F1</CardTitle><CardDescription>Balanced score across all 387 classes</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Test set</TableHead><TableHead className="text-right">F1</TableHead></TableRow></TableHeader>
                <TableBody>{rows.map((r) => <TableRow key={r.set}><TableCell>{r.set}</TableCell><TableCell className="text-right tabular-nums">{r.f1.toFixed(3)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
