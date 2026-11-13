import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { requireStaff } from '@/server/auth/dal';
import { db } from '@/server/db';
import { EmptyState, fmtDate, PageHeader } from '../ui';

export const metadata = { title: 'Audit logs' };
const SIZE = 50;

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  await requireStaff('audit:view');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.action ? { action: { contains: sp.action } } : {};
  const [logs, count] = await Promise.all([db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * SIZE, take: SIZE }), db.auditLog.count({ where })]);
  const actors = await db.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.actorId))] } }, select: { id: true, name: true, phone: true, roles: { select: { role: true } } } });
  const actor = new Map(actors.map((a) => [a.id, `${a.name ?? 'user'} (${a.roles.map((r) => r.role.toLowerCase()).join(', ') || 'no role'})`]));
  const pages = Math.max(1, Math.ceil(count / SIZE));
  return (
    <>
      <PageHeader title="Audit logs" description="Sensitive operations and important changes. OTP values, secrets and image contents are never logged." />
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col gap-4">
          <form className="flex gap-2" method="get"><Input name="action" defaultValue={sp.action} placeholder="Filter action (e.g. review, login)" className="h-9 w-72 bg-white" /><Button size="sm" className="h-9">Filter</Button></form>
          {logs.length === 0 ? <EmptyState title="No events" text="Events appear as people use the platform." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Resource</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(l.createdAt)}</TableCell>
                    <TableCell>{actor.get(l.actorId) ?? 'unknown'}</TableCell>
                    <TableCell className="font-mono text-xs">{l.action}</TableCell>
                    <TableCell className="text-xs">{l.resource}:{l.resourceId.slice(0, 10)}</TableCell>
                    <TableCell className="max-w-80 truncate font-mono text-[11px] text-muted-foreground">{l.metadata && Object.keys(l.metadata as object).length ? JSON.stringify(l.metadata) : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{count} events · page {page}/{pages}</span>
            <div className="flex gap-2">
              <Link href={`?${new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), page: String(page - 1) })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), page <= 1 && 'pointer-events-none opacity-50')}>Previous</Link>
              <Link href={`?${new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), page: String(page + 1) })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), page >= pages && 'pointer-events-none opacity-50')}>Next</Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
