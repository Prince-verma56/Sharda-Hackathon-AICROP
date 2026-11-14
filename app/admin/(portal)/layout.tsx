import { Manrope } from 'next/font/google';
import { LogOut } from 'lucide-react';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { LeafMark } from '@/components/marketing/home/brand';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AccountMenu } from '@/components/auth/account-menu';
import { WorkspaceMenu } from '@/components/workspace/workspace-menu';
import { brand } from '@/config/brand';
import { cn } from '@/lib/utils';
import { requireStaff } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { can, ROLE_LABELS, type Permission } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { AdminNav, type NavKey } from './admin-nav';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

const NAV: { label: string; items: { key: NavKey; href: string; label: string; perm: Permission }[] }[] = [
  {
    label: 'Operations',
    items: [
      { key: 'overview', href: '/admin', label: 'Overview', perm: 'overview:view' },
      { key: 'review', href: '/admin/expert-review', label: 'Expert review', perm: 'reviews:write' },
      { key: 'diagnoses', href: '/admin/diagnoses', label: 'Diagnoses', perm: 'diagnoses:view' },
      { key: 'farmers', href: '/admin/farmers', label: 'Farmers', perm: 'farmers:view' },
      { key: 'volunteers', href: '/admin/volunteers', label: 'Volunteers', perm: 'volunteers:manage' },
    ],
  },
  {
    label: 'Knowledge & model',
    items: [
      { key: 'knowledge', href: '/admin/knowledge-base', label: 'Knowledge base', perm: 'knowledge:view' },
      { key: 'crops', href: '/admin/crops', label: 'Crops & conditions', perm: 'crops:view' },
      { key: 'analytics', href: '/admin/analytics', label: 'Analytics', perm: 'analytics:view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { key: 'audit', href: '/admin/audit-logs', label: 'Audit logs', perm: 'audit:view' },
      { key: 'settings', href: '/admin/settings', label: 'Settings', perm: 'settings:manage' },
    ],
  },
];

export const metadata = { title: { default: 'Admin', template: `%s · ${brand.name} Admin` }, robots: { index: false, follow: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const pending = can(staff.role, 'reviews:write') ? await db.diagnosis.count({ where: { reviewStatus: { in: ['PENDING', 'NEEDS_INFO'] } } }) : 0;
  const groups = NAV.map((g) => ({ label: g.label, items: g.items.filter((i) => can(staff.role, i.perm)).map(({ key, href, label }) => ({ key, href, label })) })).filter((g) => g.items.length);
  const initials = (staff.name ?? 'Admin').split(/\s/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

  return (
    <div className={`theme-crop ${manrope.variable} flex min-h-dvh flex-1 bg-[#f3f2ec]`}>
      <SidebarProvider>
        <Sidebar collapsible="icon" className="border-r-0">
          <SidebarHeader className="px-3 py-4">
            <span className="flex items-center gap-2 text-base font-bold"><LeafMark className="size-6 shrink-0 text-[var(--crop-green-600)]" /> <span className="truncate group-data-[collapsible=icon]:hidden">{brand.name} Admin</span></span>
          </SidebarHeader>
          <SidebarContent>
            <AdminNav groups={groups} pending={pending} />
          </SidebarContent>
          <SidebarFooter className="p-3">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <Avatar className="size-8"><AvatarFallback>{initials}</AvatarFallback></Avatar>
              <span className="flex min-w-0 flex-col text-xs"><b className="truncate">{staff.name ?? maskPhone(staff.phone)}</b><span className="text-muted-foreground">{ROLE_LABELS[staff.role]}</span></span>
            </div>
            <SignOutButton className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-full justify-start')}>
              <LogOut /> <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
            </SignOutButton>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="bg-[#f3f2ec]">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-[#f3f2ec]/85 px-4 backdrop-blur lg:px-8">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <span className="truncate text-sm text-muted-foreground">Signed in as <b className="text-foreground">{ROLE_LABELS[staff.role]}</b> · phone verified</span>
            <WorkspaceMenu current="admin" className="ml-auto shrink-0" />
            <AccountMenu className="shrink-0" label={staff.name ? `${staff.name} · ${ROLE_LABELS[staff.role]}` : ROLE_LABELS[staff.role]} />
          </header>
          <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
