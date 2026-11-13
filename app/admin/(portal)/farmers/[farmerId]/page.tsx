import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cropName } from '@/lib/crops';
import { setUserStatus } from '@/server/admin/actions';
import { requireStaff } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { can } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { EmptyState, fmtDate, PageHeader, pct, ReviewBadge } from '../../ui';

export const metadata = { title: 'Farmer' };

export default async function FarmerDetail({ params }: { params: Promise<{ farmerId: string }> }) {
  const staff = await requireStaff('farmers:view');
  const { farmerId } = await params;
  const f = await db.user.findFirst({
    where: { id: farmerId, roles: { some: { role: 'FARMER' } } },
    include: {
      farmerProfile: true,
      farms: { include: { cropRecords: true } },
      diagnoses: { orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, createdAt: true, predictedCrop: true, predictedCondition: true, confidence: true, reviewStatus: true } },
    },
  });
  if (!f) notFound();
  const p = f.farmerProfile;
  return (
    <>
      <Link href="/admin/farmers" className="mb-3 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Farmers</Link>
      <PageHeader
        title={p?.preferredName ?? 'Unnamed farmer'}
        description={`${maskPhone(f.phone)} · joined ${fmtDate(f.createdAt)} · ${f.status.toLowerCase()}`}
        actions={
          can(staff.role, 'farmers:manage') ? (
            <form action={setUserStatus}>
              <input type="hidden" name="id" value={f.id} />
              <input type="hidden" name="status" value={f.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'} />
              <Button type="submit" variant={f.status === 'ACTIVE' ? 'destructive' : 'default'} size="sm">{f.status === 'ACTIVE' ? 'Suspend account' : 'Reactivate'}</Button>
            </form>
          ) : null
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Language</dt><dd>{p?.language ?? '—'}</dd>
              <dt className="text-muted-foreground">Village</dt><dd>{p?.village || '—'}</dd>
              <dt className="text-muted-foreground">District</dt><dd>{p?.district || '—'}</dd>
              <dt className="text-muted-foreground">State</dt><dd>{p?.state || '—'}</dd>
              <dt className="text-muted-foreground">Main crops</dt><dd>{p?.mainCrops.length ? p.mainCrops.map((c) => cropName(c)).join(', ') : '—'}</dd>
              <dt className="text-muted-foreground">Photo consent</dt><dd>{p?.photoConsentAt ? fmtDate(p.photoConsentAt) : 'not given'}</dd>
              <dt className="text-muted-foreground">Onboarded</dt><dd>{p?.onboardedAt ? 'yes' : 'skipped / pending'}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Farms & crops</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {f.farms.length === 0 ? <p className="text-muted-foreground">No farm saved.</p> : f.farms.map((farm) => (
              <div key={farm.id} className="mb-2">
                <p className="font-medium">{farm.name}{farm.isPrimary ? ' (primary)' : ''}</p>
                <p className="text-muted-foreground">{farm.locationLabel ?? (farm.latitude != null ? 'GPS location saved' : 'No location')}</p>
                <p>{farm.cropRecords.map((c) => cropName(c.crop)).join(', ') || 'No crops checked yet'}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p>{f.diagnoses.length} diagnoses</p>
            <p className="text-muted-foreground">Last login {f.lastLoginAt ? fmtDate(f.lastLoginAt) : '—'}</p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4 rounded-2xl">
        <CardHeader><CardTitle>Diagnosis history</CardTitle></CardHeader>
        <CardContent>
          {f.diagnoses.length === 0 ? <EmptyState title="No diagnoses" text="This farmer has not checked a crop yet." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Crop</TableHead><TableHead>Condition</TableHead><TableHead className="text-right">Score</TableHead><TableHead>Review</TableHead></TableRow></TableHeader>
              <TableBody>
                {f.diagnoses.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-muted-foreground">{fmtDate(d.createdAt)}</TableCell>
                    <TableCell>{cropName(d.predictedCrop)}</TableCell>
                    <TableCell><Link className="font-medium hover:underline" href={`/admin/diagnoses/${d.id}`}>{d.predictedCondition}</Link></TableCell>
                    <TableCell className="text-right tabular-nums">{pct(d.confidence)}</TableCell>
                    <TableCell><ReviewBadge status={d.reviewStatus} /></TableCell>
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
