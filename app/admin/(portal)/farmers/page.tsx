import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireStaff } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { db } from '@/server/db';
import { EmptyState, fmtDate, PageHeader } from '../ui';

export const metadata = { title: 'Farmers' };

export default async function FarmersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff('farmers:view');
  const q = (await searchParams).q?.trim();
  const where: Prisma.UserWhereInput = {
    roles: { some: { role: 'FARMER' } },
    ...(q ? { OR: [{ farmerProfile: { preferredName: { contains: q, mode: 'insensitive' } } }, { farmerProfile: { district: { contains: q, mode: 'insensitive' } } }, { farmerProfile: { village: { contains: q, mode: 'insensitive' } } }] } : {}),
  };
  const farmers = await db.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, phone: true, status: true, createdAt: true, lastLoginAt: true, farmerProfile: { select: { preferredName: true, district: true, state: true, language: true, onboardedAt: true } }, _count: { select: { diagnoses: true, farms: true } } },
  });
  return (
    <>
      <PageHeader title="Farmers" description="Phone numbers are masked. Only aggregated or necessary details are shown." />
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col gap-4">
          <form className="flex gap-2" method="get">
            <Input name="q" defaultValue={q} placeholder="Search name, village or district" className="h-9 w-72 bg-white" />
            <Button type="submit" size="sm" className="h-9">Search</Button>
          </form>
          {farmers.length === 0 ? (
            <EmptyState title="No farmers yet" text="Farmers appear after their first OTP login." />
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Farmer</TableHead><TableHead>Phone</TableHead><TableHead>Location</TableHead><TableHead>Language</TableHead><TableHead className="text-right">Checks</TableHead><TableHead>Joined</TableHead><TableHead>Last login</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {farmers.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell><Link href={`/admin/farmers/${f.id}`} className="font-medium hover:underline">{f.farmerProfile?.preferredName ?? 'Unnamed farmer'}</Link></TableCell>
                    <TableCell className="font-mono text-xs">{maskPhone(f.phone)}</TableCell>
                    <TableCell className="text-muted-foreground">{[f.farmerProfile?.district, f.farmerProfile?.state].filter(Boolean).join(', ') || '—'}</TableCell>
                    <TableCell>{f.farmerProfile?.language ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{f._count.diagnoses}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(f.createdAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{f.lastLoginAt ? fmtDate(f.lastLoginAt) : '—'}</TableCell>
                    <TableCell><Badge variant={f.status === 'ACTIVE' ? 'secondary' : 'destructive'}>{f.status.toLowerCase()}</Badge></TableCell>
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
