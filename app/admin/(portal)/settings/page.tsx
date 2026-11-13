import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { genAiStatus } from '@/ai/genai/provider';
import { revokeRoleInvitation, revokeUserRole, setUserStatus } from '@/server/admin/actions';
import { requireStaff } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { can, ROLE_LABELS } from '@/server/auth/rbac';
import { researchConfigured } from '@/server/cropai/research';
import { getSettings } from '@/server/cropai/settings';
import { db } from '@/server/db';
import { fmtDate, PageHeader } from '../ui';
import { InviteForm, PlatformSettingsForm } from './settings-forms';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const staff = await requireStaff('settings:manage');
  const superAdmin = can(staff.role, 'admins:manage');
  const [settings, admins, invites] = await Promise.all([
    getSettings(),
    db.user.findMany({
      where: { roles: { some: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, phone: true, status: true, lastLoginAt: true, roles: { select: { role: true } }, adminProfile: { select: { adminLevel: true } } },
    }),
    db.roleInvitation.findMany({ where: { role: 'ADMIN', status: 'PENDING', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } }),
  ]);
  const genai = genAiStatus();
  const integrations = [
    ['Authentication', `Phone + OTP · ${process.env.AUTH_OTP_PROVIDER === 'twilio_verify' ? 'Twilio Verify (real SMS)' : process.env.AUTH_OTP_PROVIDER === 'dev' ? 'development mode (no SMS, localhost only)' : 'not configured'}`],
    ['Twilio Verify', process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID ? 'credentials configured' : 'not configured'],
    ['Model inference', process.env.AI_INFERENCE_BASE_URL ? 'configured' : 'not configured'],
    ['Text GenAI provider', genai.configured ? `${genai.provider} · ${genai.model}` : 'not configured (approved-guidance fallback)'],
    ['Vapi voice', process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ? `configured${/^https:/.test(process.env.APP_PUBLIC_URL ?? '') ? ' · tools enabled' : ' · tools need a public https URL'}` : 'not configured'],
    ['TinyFish research', researchConfigured() ? 'configured' : 'not configured'],
    ['LangSmith tracing', process.env.LANGSMITH_API_KEY || process.env.LANGCHAIN_API_KEY ? 'configured' : 'not configured'],
  ];

  return (
    <>
      <PageHeader title="Settings" description="Platform configuration. Secrets live in server environment variables and are never shown here." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl"><CardHeader><CardTitle>Platform</CardTitle></CardHeader><CardContent><PlatformSettingsForm values={settings} /></CardContent></Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Integrations</CardTitle><CardDescription>Status only — values are not exposed.</CardDescription></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {integrations.map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 rounded-2xl">
        <CardHeader>
          <CardTitle>Administrators</CardTitle>
          <CardDescription>No public admin registration. A super admin invites a mobile number; the role is added after that number signs in with OTP.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {superAdmin ? <InviteForm role="ADMIN" allowAdmin /> : <p className="text-sm text-muted-foreground">Only a super admin can grant admin access.</p>}
          {invites.length > 0 && (
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Pending admin invitations</span>
              {invites.map((i) => (
                <form key={i.id} action={revokeRoleInvitation} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                  <input type="hidden" name="id" value={i.id} />
                  <span>{maskPhone(i.phone)} · {i.adminLevel ? ROLE_LABELS[i.adminLevel] : 'Administrator'} · expires {fmtDate(i.expiresAt)}</span>
                  {superAdmin && <Button type="submit" size="xs" variant="ghost">Revoke</Button>}
                </form>
              ))}
            </div>
          )}
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Role</TableHead><TableHead>Last login</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {admins.map((u) => {
                const isSuper = u.roles.some((r) => r.role === 'SUPER_ADMIN');
                return (
                  <TableRow key={u.id}>
                    <TableCell>{u.name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{maskPhone(u.phone)}</TableCell>
                    <TableCell>{isSuper ? ROLE_LABELS.SUPER_ADMIN : ROLE_LABELS[u.adminProfile?.adminLevel ?? 'ADMIN']}</TableCell>
                    <TableCell className="text-muted-foreground">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : 'never'}</TableCell>
                    <TableCell><Badge variant={u.status === 'ACTIVE' ? 'secondary' : 'destructive'}>{u.status.toLowerCase()}</Badge></TableCell>
                    <TableCell className="flex justify-end gap-1">
                      {superAdmin && u.id !== staff.userId && !isSuper && (
                        <>
                          <form action={setUserStatus}>
                            <input type="hidden" name="id" value={u.id} />
                            <input type="hidden" name="status" value={u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'} />
                            <Button type="submit" size="xs" variant="ghost">{u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</Button>
                          </form>
                          <form action={revokeUserRole}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="role" value="ADMIN" />
                            <Button type="submit" size="xs" variant="ghost">Remove admin</Button>
                          </form>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
