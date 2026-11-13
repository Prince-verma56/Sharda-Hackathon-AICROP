import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { revokeRoleInvitation, revokeUserRole } from '@/server/admin/actions';
import { requireStaff } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { db } from '@/server/db';
import { InviteForm } from '../settings/settings-forms';
import { EmptyState, fmtDate, PageHeader } from '../ui';

export const metadata = { title: 'Volunteers' };

export default async function VolunteersPage() {
  await requireStaff('volunteers:manage');
  const [volunteers, invites] = await Promise.all([
    db.user.findMany({
      where: { roles: { some: { role: 'VOLUNTEER' } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, phone: true, status: true, lastLoginAt: true, volunteerProfile: true, roles: { select: { role: true } } },
    }),
    db.roleInvitation.findMany({ where: { role: 'VOLUNTEER', status: { in: ['PENDING', 'EXPIRED'] } }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  return (
    <>
      <PageHeader title="Volunteers" description="Volunteers join by invitation only. They sign in with the same phone + OTP login; the role is added after verification." />
      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Invite a volunteer</CardTitle><CardDescription>An existing farmer keeps their farmer account and gains the volunteer workspace.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <InviteForm role="VOLUNTEER" />
          {invites.length > 0 && (
            <ul className="flex flex-col gap-2 text-sm">
              {invites.map((i) => (
                <li key={i.id}>
                  <form action={revokeRoleInvitation} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                    <input type="hidden" name="id" value={i.id} />
                    <span>{maskPhone(i.phone)} · {i.serviceArea ?? 'no area'} · {i.status === 'EXPIRED' || i.expiresAt < new Date() ? 'expired' : `expires ${fmtDate(i.expiresAt)}`}</span>
                    {i.status === 'PENDING' && <Button type="submit" size="xs" variant="ghost">Revoke</Button>}
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card className="mt-4 rounded-2xl">
        <CardHeader><CardTitle>Volunteers ({volunteers.length})</CardTitle></CardHeader>
        <CardContent>
          {volunteers.length === 0 ? (
            <EmptyState title="No volunteers yet" text="Invite a mobile number above. The volunteer appears here after their first sign-in." />
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Service area</TableHead><TableHead>Verification</TableHead><TableHead>Training</TableHead><TableHead>Also farmer</TableHead><TableHead>Last login</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {volunteers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{v.name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{maskPhone(v.phone)}</TableCell>
                    <TableCell>{v.volunteerProfile?.serviceArea ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline">{v.volunteerProfile?.verificationStatus.toLowerCase() ?? 'pending'}</Badge></TableCell>
                    <TableCell>{v.volunteerProfile?.trainingStatus.toLowerCase().replace('_', ' ') ?? 'not started'}</TableCell>
                    <TableCell>{v.roles.some((r) => r.role === 'FARMER') ? 'yes' : 'no'}</TableCell>
                    <TableCell className="text-muted-foreground">{v.lastLoginAt ? fmtDate(v.lastLoginAt) : 'never'}</TableCell>
                    <TableCell>
                      <form action={revokeUserRole}>
                        <input type="hidden" name="userId" value={v.id} />
                        <input type="hidden" name="role" value="VOLUNTEER" />
                        <Button type="submit" size="xs" variant="ghost">Remove role</Button>
                      </form>
                    </TableCell>
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
