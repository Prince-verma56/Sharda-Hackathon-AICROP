import Link from 'next/link';
import { Activity, Clapperboard, HandHeart, Search, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { revokeRoleInvitation } from '@/server/admin/actions';
import { reviewVideo, setCampaignStatus, setVolunteerStatus } from '@/server/admin/volunteer-actions';
import { requireStaff } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { db } from '@/server/db';
import { InviteForm } from '../settings/settings-forms';
import { EmptyState, fmtDate, PageHeader, StatCard } from '../ui';
import { CampaignForm } from './campaign-form';

export const metadata = { title: 'Volunteers' };

const TABS = [
  { id: 'volunteers', label: 'Volunteers' },
  { id: 'invitations', label: 'Invitations' },
  { id: 'videos', label: 'Video review' },
  { id: 'campaigns', label: 'Campaigns' },
] as const;
type Tab = (typeof TABS)[number]['id'];
const STATUSES = ['PENDING', 'VERIFIED', 'SUSPENDED'] as const;

const statusBadge = (status: string) => (
  <Badge variant={status === 'VERIFIED' ? 'secondary' : status === 'SUSPENDED' ? 'destructive' : 'outline'}>{status === 'VERIFIED' ? 'approved' : status.toLowerCase()}</Badge>
);

export default async function VolunteersPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; status?: string }> }) {
  await requireStaff('volunteers:manage');
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === params.tab) ? (params.tab as Tab) : 'volunteers';
  const q = (params.q ?? '').trim().slice(0, 60);
  const status = STATUSES.find((s) => s === params.status);

  const [total, byStatus, activityTotals, pendingVideos] = await Promise.all([
    db.user.count({ where: { roles: { some: { role: 'VOLUNTEER' } } } }),
    db.volunteerProfile.groupBy({ by: ['verificationStatus'], _count: true, where: { user: { roles: { some: { role: 'VOLUNTEER' } } } } }),
    db.volunteerActivity.aggregate({ _count: true, _sum: { farmersReached: true } }),
    db.volunteerVideo.count({ where: { status: 'PENDING' } }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.verificationStatus === s)?._count ?? 0;

  return (
    <>
      <PageHeader title="Volunteers" description="Invitation-only volunteers. They sign in with the same phone + OTP login; the role is added after the invited number is verified." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Volunteers" value={total} hint={`${count('VERIFIED')} approved · ${count('PENDING')} pending · ${count('SUSPENDED')} suspended`} icon={Users} />
        <StatCard label="Activities logged" value={activityTotals._count} hint="field visits, sessions, farmer help" icon={Activity} />
        <StatCard label="Farmers reached" value={activityTotals._sum.farmersReached ?? 0} hint="as reported by volunteers" icon={HandHeart} />
        <StatCard label="Videos awaiting review" value={pendingVideos} hint="published only after approval" icon={Clapperboard} />
      </div>

      <nav aria-label="Volunteer sections" className="mt-5 flex flex-wrap gap-1 rounded-2xl bg-muted p-1 sm:w-fit">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/volunteers?tab=${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            className={cn('rounded-xl px-4 py-2 text-sm font-medium transition-colors', tab === t.id ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            {t.label}
            {t.id === 'videos' && pendingVideos > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-900">{pendingVideos}</span>}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        {tab === 'volunteers' && <VolunteerList q={q} status={status} />}
        {tab === 'invitations' && <Invitations />}
        {tab === 'videos' && <VideoReview />}
        {tab === 'campaigns' && <Campaigns />}
      </div>
    </>
  );
}

async function VolunteerList({ q, status }: { q: string; status?: (typeof STATUSES)[number] }) {
  const digits = q.replace(/\D/g, '');
  const volunteers = await db.user.findMany({
    where: {
      roles: { some: { role: 'VOLUNTEER' } },
      ...(status ? { volunteerProfile: { is: { verificationStatus: status } } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
              { volunteerProfile: { is: { OR: [{ serviceArea: { contains: q, mode: 'insensitive' as const } }, { district: { contains: q, mode: 'insensitive' as const } }, { village: { contains: q, mode: 'insensitive' as const } }] } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, name: true, phone: true, lastLoginAt: true, volunteerProfile: true, roles: { select: { role: true } } },
  });
  const activity = await db.volunteerActivity.groupBy({ by: ['volunteerId'], where: { volunteerId: { in: volunteers.map((v) => v.id) } }, _count: true, _sum: { farmersReached: true } });
  const stats = new Map(activity.map((a) => [a.volunteerId, a]));
  return (
    <Card className="rounded-2xl">
      <CardHeader className="gap-3">
        <CardTitle>Volunteers ({volunteers.length})</CardTitle>
        <form className="flex flex-wrap gap-2" role="search">
          <input type="hidden" name="tab" value="volunteers" />
          <div className="relative min-w-60 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Name, phone, area, district, village" className="h-9 bg-white pl-9" />
          </div>
          <select name="status" defaultValue={status ?? ''} className="h-9 rounded-lg border border-input bg-white px-2 text-sm" aria-label="Approval status">
            <option value="">All statuses</option>
            <option value="PENDING">Pending approval</option>
            <option value="VERIFIED">Approved</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <Button type="submit" size="sm" className="h-9">
            Filter
          </Button>
        </form>
      </CardHeader>
      <CardContent>
        {volunteers.length === 0 ? (
          <EmptyState title={q || status ? 'No matching volunteers' : 'No volunteers yet'} text={q || status ? 'Try a different search or status.' : 'Send an invitation from the Invitations tab. The volunteer appears here after verifying their number.'} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Training</TableHead>
                <TableHead className="text-right">Activities</TableHead>
                <TableHead className="text-right">Farmers</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {volunteers.map((v) => {
                const vs = v.volunteerProfile?.verificationStatus ?? 'PENDING';
                const s = stats.get(v.id);
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Link href={`/admin/volunteers/${v.id}`} className="font-medium hover:underline">
                        {v.name ?? '—'}
                      </Link>
                      {v.roles.some((r) => r.role === 'FARMER') && <span className="ml-1.5 text-xs text-muted-foreground">· farmer</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{maskPhone(v.phone)}</TableCell>
                    <TableCell className="max-w-48 truncate">{[v.volunteerProfile?.serviceArea, v.volunteerProfile?.district].filter(Boolean).join(' · ') || '—'}</TableCell>
                    <TableCell>{statusBadge(vs)}</TableCell>
                    <TableCell className="text-sm">{(v.volunteerProfile?.trainingStatus ?? 'NOT_STARTED').toLowerCase().replace('_', ' ')}</TableCell>
                    <TableCell className="text-right tabular-nums">{s?._count ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{s?._sum.farmersReached ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">{v.lastLoginAt ? fmtDate(v.lastLoginAt) : 'never'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {vs !== 'VERIFIED' && (
                          <form action={setVolunteerStatus}>
                            <input type="hidden" name="userId" value={v.id} />
                            <input type="hidden" name="status" value="VERIFIED" />
                            <Button type="submit" size="xs">
                              <ShieldCheck /> Approve
                            </Button>
                          </form>
                        )}
                        {vs !== 'SUSPENDED' && (
                          <form action={setVolunteerStatus}>
                            <input type="hidden" name="userId" value={v.id} />
                            <input type="hidden" name="status" value="SUSPENDED" />
                            <Button type="submit" size="xs" variant="ghost">
                              Suspend
                            </Button>
                          </form>
                        )}
                        <Link href={`/admin/volunteers/${v.id}`} className={buttonVariants({ size: 'xs', variant: 'outline' })}>
                          Details
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

async function Invitations() {
  const invites = await db.roleInvitation.findMany({ where: { role: 'VOLUNTEER' }, orderBy: { createdAt: 'desc' }, take: 50, include: { invitedBy: { select: { name: true } } } });
  const now = new Date();
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <Card className="rounded-2xl xl:col-span-3">
        <CardHeader>
          <CardTitle>Invite a volunteer</CardTitle>
          <CardDescription>An existing farmer keeps their farmer account and reports, and gains the volunteer workspace. One active invitation per number — a new one replaces the old link.</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm role="VOLUNTEER" />
        </CardContent>
      </Card>
      <Card className="rounded-2xl xl:col-span-2">
        <CardHeader>
          <CardTitle>Recent invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <EmptyState title="No invitations yet" text="Invitations you send appear here with their status." />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {invites.map((i) => {
                const state = i.status === 'PENDING' && i.expiresAt <= now ? 'EXPIRED' : i.status;
                return (
                  <li key={i.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {i.inviteeName ?? maskPhone(i.phone)} {i.inviteeName && <span className="font-mono text-xs text-muted-foreground">{maskPhone(i.phone)}</span>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[i.serviceArea, i.district].filter(Boolean).join(' · ') || 'no area'} · {state === 'PENDING' ? `expires ${fmtDate(i.expiresAt)}` : state.toLowerCase()}
                        {i.invitedBy.name ? ` · by ${i.invitedBy.name}` : ''}
                      </span>
                    </span>
                    {state === 'PENDING' ? (
                      <form action={revokeRoleInvitation}>
                        <input type="hidden" name="id" value={i.id} />
                        <Button type="submit" size="xs" variant="ghost">
                          Revoke
                        </Button>
                      </form>
                    ) : (
                      <Badge variant={state === 'ACCEPTED' ? 'secondary' : 'outline'}>{state.toLowerCase()}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function VideoReview() {
  const videos = await db.volunteerVideo.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 40, include: { volunteer: { select: { name: true, phone: true } } } });
  if (!videos.length) return <EmptyState title="No video submissions yet" text="Educational videos uploaded by volunteers appear here for review before farmers can see them." />;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {videos.map((v) => (
        <Card key={v.id} className="overflow-hidden rounded-2xl pt-0">
          <video src={`/api/v1/videos/${v.id}`} poster={v.thumbnailKey ? `/api/v1/videos/${v.id}/thumbnail` : undefined} controls preload="none" className="aspect-video w-full bg-black" />
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{v.title}</p>
                <p className="text-xs text-muted-foreground">
                  {v.volunteer.name ?? maskPhone(v.volunteer.phone)} · {fmtDate(v.createdAt)} · {(v.bytes / 1024 / 1024).toFixed(1)} MB{v.language ? ` · ${v.language}` : ''}
                </p>
              </div>
              {statusBadge(v.status === 'APPROVED' ? 'VERIFIED' : v.status === 'REJECTED' ? 'SUSPENDED' : 'PENDING')}
            </div>
            {v.description && <p className="line-clamp-3 text-sm text-muted-foreground">{v.description}</p>}
            {v.status === 'PENDING' ? (
              <form action={reviewVideo} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={v.id} />
                <Textarea name="note" rows={2} maxLength={300} placeholder="Note for the volunteer (optional)" />
                <div className="flex gap-2">
                  <Button type="submit" name="decision" value="APPROVED" size="sm">
                    Approve &amp; publish
                  </Button>
                  <Button type="submit" name="decision" value="REJECTED" size="sm" variant="outline">
                    Reject
                  </Button>
                </div>
              </form>
            ) : (
              v.reviewNote && <p className="rounded-lg bg-muted px-3 py-2 text-xs">Note: {v.reviewNote}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function Campaigns() {
  const campaigns = await db.campaign.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 50, include: { _count: { select: { activities: true } } } });
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <Card className="rounded-2xl xl:col-span-2">
        <CardHeader>
          <CardTitle>New campaign</CardTitle>
          <CardDescription>Active campaigns appear in every volunteer’s workspace; volunteers log activities against them.</CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignForm />
        </CardContent>
      </Card>
      <Card className="rounded-2xl xl:col-span-3">
        <CardHeader>
          <CardTitle>Campaigns ({campaigns.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <EmptyState title="No campaigns yet" text="Create one to give volunteers a shared goal." />
          ) : (
            <ul className="flex flex-col gap-2">
              {campaigns.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 rounded-xl bg-muted p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="block font-medium">{c.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.region ?? 'all regions'} · {c._count.activities} activities · {c.status.toLowerCase()}
                      {c.endsOn ? ` · ends ${c.endsOn.toLocaleDateString('en-IN')}` : ''}
                    </span>
                  </span>
                  <form action={setCampaignStatus} className="flex gap-1">
                    <input type="hidden" name="id" value={c.id} />
                    {(['ACTIVE', 'COMPLETED', 'ARCHIVED'] as const)
                      .filter((s) => s !== c.status)
                      .map((s) => (
                        <Button key={s} type="submit" name="status" value={s} size="xs" variant="outline">
                          {s === 'ACTIVE' ? 'Reopen' : s === 'COMPLETED' ? 'Complete' : 'Archive'}
                        </Button>
                      ))}
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
