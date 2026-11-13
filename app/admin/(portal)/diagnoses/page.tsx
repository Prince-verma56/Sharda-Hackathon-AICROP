import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cropName } from '@/lib/crops';
import { cn } from '@/lib/utils';
import { listDiagnoses } from '@/server/admin/queries';
import { requireStaff } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { tryGetTaxonomy } from '@/server/cropai/taxonomy';
import { EmptyState, fmtDate, PageHeader, pct, ReviewBadge } from '../ui';

export const metadata = { title: 'Diagnoses' };

const SELECT = 'h-9 rounded-lg border border-input bg-white px-2.5 text-sm';

export default async function DiagnosesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff('diagnoses:view');
  const sp = await searchParams;
  const filters = { q: sp.q?.trim() || undefined, crop: sp.crop || undefined, review: sp.review || undefined, sort: (sp.sort as 'newest') || 'newest', page: Number(sp.page) || 1 };
  const [{ rows, count, page, pages }, taxonomy] = await Promise.all([listDiagnoses(filters), tryGetTaxonomy()]);
  const qs = (p: number) => `?${new URLSearchParams({ ...(filters.q ? { q: filters.q } : {}), ...(filters.crop ? { crop: filters.crop } : {}), ...(filters.review ? { review: filters.review } : {}), sort: filters.sort, page: String(p) })}`;

  return (
    <>
      <PageHeader title="Diagnoses" description={`${count} record${count === 1 ? '' : 's'} · original model outputs, never edited`} />
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col gap-4">
          <form className="flex flex-wrap items-center gap-2" method="get">
            <Input name="q" defaultValue={filters.q} placeholder="Search condition or ID" className="h-9 w-56 bg-white" />
            <select name="crop" defaultValue={filters.crop ?? ''} className={SELECT} aria-label="Crop">
              <option value="">All crops</option>
              {taxonomy?.crops.map((c) => <option key={c.id} value={c.id}>{cropName(c.id)}</option>)}
            </select>
            <select name="review" defaultValue={filters.review ?? ''} className={SELECT} aria-label="Review status">
              <option value="">Any review status</option>
              {['UNREVIEWED', 'PENDING', 'NEEDS_INFO', 'CONFIRMED', 'CHALLENGED'].map((s) => <option key={s} value={s}>{s.toLowerCase().replace('_', ' ')}</option>)}
            </select>
            <select name="sort" defaultValue={filters.sort} className={SELECT} aria-label="Sort">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="score_asc">Lowest model score</option>
              <option value="score_desc">Highest model score</option>
            </select>
            <Button type="submit" size="sm" className="h-9">Apply</Button>
            <Link href="/admin/diagnoses" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Reset</Link>
          </form>
          {rows.length === 0 ? (
            <EmptyState title="No matching diagnoses" text="Adjust the filters, or wait for farmers to check crops." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead className="w-14" /><TableHead>When</TableHead><TableHead>Farmer</TableHead><TableHead>Crop</TableHead><TableHead>Condition</TableHead><TableHead className="text-right">Score</TableHead><TableHead>Flags</TableHead><TableHead>Model</TableHead><TableHead>Review</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- authorised private image route */}
                    <TableCell><img src={`/api/v1/images/diagnoses/${d.id}`} alt="" className="size-10 rounded-lg object-cover" loading="lazy" /></TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(d.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">{d.farmer.farmerProfile?.preferredName ?? maskPhone(d.farmer.phone)}</TableCell>
                    <TableCell>{cropName(d.predictedCrop)}</TableCell>
                    <TableCell><Link href={`/admin/diagnoses/${d.id}`} className="font-medium hover:underline">{d.predictedCondition}</Link></TableCell>
                    <TableCell className="text-right tabular-nums">{pct(d.confidence)}</TableCell>
                    <TableCell className="text-xs text-amber-700">{(d.advisories as { code: string }[]).map((a) => a.code.replace(/_/g, ' ').toLowerCase()).join(', ')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.modelVersion}</TableCell>
                    <TableCell><ReviewBadge status={d.reviewStatus} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-2">
              <Link aria-disabled={page <= 1} href={qs(page - 1)} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), page <= 1 && 'pointer-events-none opacity-50')}>Previous</Link>
              <Link aria-disabled={page >= pages} href={qs(page + 1)} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), page >= pages && 'pointer-events-none opacity-50')}>Next</Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
