import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { KnowledgeStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cropName, splitLabel } from '@/lib/crops';
import { cn } from '@/lib/utils';
import { requireStaff } from '@/server/auth/dal';
import { can } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { EmptyState, fmtDate, PageHeader } from '../ui';

export const metadata = { title: 'Knowledge base' };

const STATUS_STYLE: Record<KnowledgeStatus, string> = { DRAFT: 'bg-muted text-muted-foreground', IN_REVIEW: 'bg-amber-100 text-amber-900', APPROVED: 'bg-[var(--crop-green-100)] text-[var(--crop-green-900)]', REJECTED: 'bg-red-100 text-red-900' };

export default async function KnowledgeList({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const staff = await requireStaff('knowledge:view');
  const status = (await searchParams).status as KnowledgeStatus | undefined;
  const [entries, counts] = await Promise.all([
    db.knowledgeEntry.findMany({ where: status ? { status } : {}, orderBy: { updatedAt: 'desc' }, take: 100, include: { createdBy: { select: { name: true } }, reviewedBy: { select: { name: true } } } }),
    db.knowledgeEntry.groupBy({ by: ['status'], _count: true }),
  ]);
  const count = (s: KnowledgeStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  return (
    <>
      <PageHeader
        title="Knowledge base"
        description="Only APPROVED entries reach farmers. Edits send an entry back to review; approval needs a different expert and a source."
        actions={can(staff.role, 'knowledge:edit') ? <Link href="/admin/knowledge-base/new" className={buttonVariants()}><Plus /> New entry</Link> : null}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {[undefined, 'IN_REVIEW', 'APPROVED', 'DRAFT', 'REJECTED'].map((s) => (
          <Link key={s ?? 'all'} href={s ? `?status=${s}` : '?'} className={cn(buttonVariants({ variant: status === s ? 'default' : 'outline', size: 'sm' }), 'bg-white aria-[current=page]:bg-primary')} aria-current={status === s ? 'page' : undefined}>
            {s ? `${s.replace('_', ' ').toLowerCase()} (${count(s as KnowledgeStatus)})` : 'All'}
          </Link>
        ))}
      </div>
      <Card className="rounded-2xl">
        <CardContent>
          {entries.length === 0 ? (
            <EmptyState title="No entries" text="Create guidance for a model-supported condition, cite a source, and have another expert approve it." />
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Crop · condition</TableHead><TableHead>Source</TableHead><TableHead>Author</TableHead><TableHead>Reviewed</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell><Link href={`/admin/knowledge-base/${e.id}`} className="font-medium hover:underline">{e.title}</Link><span className="block text-xs text-muted-foreground">v{e.version}</span></TableCell>
                    <TableCell>{cropName(e.crop)} · {splitLabel(e.conditionLabel).condition}</TableCell>
                    <TableCell className="max-w-48 truncate text-xs text-muted-foreground">{e.sourceOrganisation ?? e.sourceUrl ?? '—'}</TableCell>
                    <TableCell className="text-sm">{e.createdBy.name ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.lastReviewedAt ? `${fmtDate(e.lastReviewedAt)} · ${e.reviewedBy?.name ?? ''}` : '—'}</TableCell>
                    <TableCell><Badge className={cn('border-0', STATUS_STYLE[e.status])}>{e.status.replace('_', ' ').toLowerCase()}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
