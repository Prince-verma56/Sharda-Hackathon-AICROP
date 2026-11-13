import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CropThumb } from '@/components/crops/crop-thumb';
import { cropName } from '@/lib/crops';
import { requireStaff } from '@/server/auth/dal';
import { can } from '@/server/auth/rbac';
import { getCropImages } from '@/server/cropai/crop-images';
import { tryGetTaxonomy } from '@/server/cropai/taxonomy';
import { db } from '@/server/db';
import { PageHeader } from '../ui';

export const metadata = { title: 'Crops & conditions' };

export default async function CropsPage() {
  const staff = await requireStaff('crops:view');
  const [taxonomy, usage, approved, cropImages] = await Promise.all([
    tryGetTaxonomy(),
    db.diagnosis.groupBy({ by: ['predictedLabel'], _count: true }),
    db.knowledgeEntry.findMany({ where: { status: 'APPROVED' }, select: { conditionLabel: true, id: true } }),
    getCropImages(),
  ]);
  if (!taxonomy) return <Alert variant="destructive"><AlertDescription>The inference service is offline, so the model taxonomy cannot be loaded.</AlertDescription></Alert>;
  const used = new Map(usage.map((u) => [u.predictedLabel, u._count]));
  const kb = new Map(approved.map((a) => [a.conditionLabel, a.id]));
  const covered = taxonomy.crops.reduce((n, c) => n + c.classes.filter((k) => kb.has(k.label)).length, 0);

  return (
    <>
      <PageHeader title="Crops & conditions" description={`Model ${taxonomy.modelVersion}: ${taxonomy.cropCount} crops, ${taxonomy.classCount} conditions (read from the checkpoint). Approved guidance covers ${covered} of ${taxonomy.classCount}. Upstream metrics are the model authors' held-out test results, not field validation.`} />
      <Card className="rounded-2xl">
        <CardContent>
          <Accordion>
            {taxonomy.crops.map((crop) => {
              const cropUses = crop.classes.reduce((n, k) => n + (used.get(k.label) ?? 0), 0);
              return (
                <AccordionItem key={crop.id} value={crop.id}>
                  <AccordionTrigger>
                    <span className="flex flex-1 items-center gap-3 text-left">
                      <CropThumb id={crop.id} images={cropImages} size="md" />
                      <span className="flex-1 font-medium">{cropName(crop.id)} <span className="text-xs font-normal text-muted-foreground">({crop.classCount} conditions)</span></span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">upstream F1 {crop.upstreamMetrics ? crop.upstreamMetrics.macroF1.toFixed(2) : '—'}</span>
                      <Badge variant="outline">{cropUses} checks</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {crop.classes.map((k) => (
                        <li key={k.label} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                          <span>{k.name}{k.upstreamMetrics && <span className="ml-2 text-xs text-muted-foreground">P {k.upstreamMetrics.precision.toFixed(2)} · R {k.upstreamMetrics.recall.toFixed(2)}</span>}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs tabular-nums text-muted-foreground">{used.get(k.label) ?? 0}</span>
                            {kb.has(k.label) ? (
                              <Link href={`/admin/knowledge-base/${kb.get(k.label)}`}><Badge className="border-0 bg-[var(--crop-green-100)] text-[var(--crop-green-900)]">guidance</Badge></Link>
                            ) : can(staff.role, 'knowledge:edit') ? (
                              <Link href={`/admin/knowledge-base/new?label=${encodeURIComponent(k.label)}`} className="text-xs text-[var(--crop-green-800)] underline">add</Link>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </>
  );
}
