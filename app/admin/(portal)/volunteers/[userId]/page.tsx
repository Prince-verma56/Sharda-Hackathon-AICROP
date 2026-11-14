import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { revokeUserRole } from '@/server/admin/actions';
import { setTrainingStatus, setVolunteerStatus } from '@/server/admin/volunteer-actions';
import { requireStaff } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { db } from '@/server/db';
import { EmptyState, fmtDate, PageHeader } from '../../ui';

export const metadata = { title: 'Volunteer' };

const KIND: Record<string, string> = { FIELD_VISIT: 'Field visit', AWARENESS_SESSION: 'Awareness session', FARMER_ASSISTANCE: 'Farmer assistance', TRAINING: 'Training' };

export default async function VolunteerDetails({ params }: { params: Promise<{ userId: string }> }) {
  await requireStaff('volunteers:manage');
  const { userId } = await params;
  const user = await db.user.findFirst({
    where: { id: userId, roles: { some: { role: 'VOLUNTEER' } } },
    include: {
      volunteerProfile: true,
      roles: { select: { role: true } },
      volunteerActivities: { orderBy: { occurredOn: 'desc' }, take: 100, include: { campaign: { select: { title: true } } } },
      volunteerVideos: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!user) notFound();
  const p = user.volunteerProfile;
  const reached = user.volunteerActivities.reduce((n, a) => n + a.farmersReached, 0);
  const status = p?.verificationStatus ?? 'PENDING';

  return (
    <>
      <Link href="/admin/volunteers" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All volunteers
      </Link>
      <PageHeader
        title={user.name ?? 'Volunteer'}
        description={`${maskPhone(user.phone)} · ${user.roles.map((r) => r.role.toLowerCase()).join(', ')} · last login ${user.lastLoginAt ? fmtDate(user.lastLoginAt) : 'never'}`}
        actions={<Badge variant={status === 'VERIFIED' ? 'secondary' : status === 'SUSPENDED' ? 'destructive' : 'outline'}>{status === 'VERIFIED' ? 'approved' : status.toLowerCase()}</Badge>}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {[
                ['Service area', p?.serviceArea],
                ['Village', p?.village],
                ['District', p?.district],
                ['State', p?.state],
                ['Languages', p?.languages.join(', ')],
                ['Preferred language', p?.preferredLanguage],
                ['Availability', p?.availability],
                ['Profile completed', p?.profileCompletedAt ? fmtDate(p.profileCompletedAt) : 'not yet'],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v || '—'}</dd>
                </div>
              ))}
            </dl>
            {p?.bio && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">{p.bio}</p>}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Access &amp; training</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={setVolunteerStatus} className="flex flex-wrap gap-2">
              <input type="hidden" name="userId" value={user.id} />
              {(['VERIFIED', 'PENDING', 'SUSPENDED'] as const).map((s) => (
                <Button key={s} type="submit" name="status" value={s} size="sm" variant={s === status ? 'default' : 'outline'} disabled={s === status}>
                  {s === 'VERIFIED' ? 'Approve' : s === 'PENDING' ? 'Mark pending' : 'Suspend'}
                </Button>
              ))}
            </form>
            <form action={setTrainingStatus} className="flex flex-wrap gap-2">
              <input type="hidden" name="userId" value={user.id} />
              {(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const).map((s) => (
                <Button key={s} type="submit" name="status" value={s} size="sm" variant={s === p?.trainingStatus ? 'default' : 'outline'} disabled={s === p?.trainingStatus}>
                  Training: {s.toLowerCase().replace('_', ' ')}
                </Button>
              ))}
            </form>
            <p className="text-xs text-muted-foreground">Suspending blocks only the volunteer workspace; a farmer account on the same number keeps working.</p>
            <form action={revokeUserRole}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="role" value="VOLUNTEER" />
              <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                Remove volunteer role
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Impact</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-center">
            {[
              ['Activities', user.volunteerActivities.length],
              ['Farmers reached', reached],
              ['Videos', user.volunteerVideos.length],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-muted p-3">
                <p className="text-2xl font-semibold tabular-nums">{v}</p>
                <p className="text-xs text-muted-foreground">{k}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 rounded-2xl">
        <CardHeader>
          <CardTitle>Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {user.volunteerActivities.length === 0 ? (
            <EmptyState title="No activities logged yet" text="Field visits, awareness sessions and farmer help appear here when the volunteer logs them." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Village</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Farmers</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.volunteerActivities.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.occurredOn.toLocaleDateString('en-IN', { dateStyle: 'medium' })}</TableCell>
                    <TableCell>{KIND[a.kind]}</TableCell>
                    <TableCell>{a.village ?? '—'}</TableCell>
                    <TableCell>{a.campaign?.title ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.farmersReached}</TableCell>
                    <TableCell className="max-w-72 truncate text-muted-foreground">{a.notes ?? ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-2xl">
        <CardHeader>
          <CardTitle>Video submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {user.volunteerVideos.length === 0 ? (
            <EmptyState title="No videos yet" text="Review submissions in the Video review tab." />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {user.volunteerVideos.map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                  <span>
                    {v.title} <span className="text-xs text-muted-foreground">· {fmtDate(v.createdAt)}</span>
                  </span>
                  <Badge variant={v.status === 'APPROVED' ? 'secondary' : v.status === 'REJECTED' ? 'destructive' : 'outline'}>{v.status.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
