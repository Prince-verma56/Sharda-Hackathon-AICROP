'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, BookOpenCheck, ClipboardCheck, FileClock, HandHeart, LayoutDashboard, ScanSearch, Settings, Sprout, Users } from 'lucide-react';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

const ICONS = { overview: LayoutDashboard, farmers: Users, volunteers: HandHeart, diagnoses: ScanSearch, review: ClipboardCheck, knowledge: BookOpenCheck, crops: Sprout, analytics: BarChart3, audit: FileClock, settings: Settings };
export type NavKey = keyof typeof ICONS;

export function AdminNav({ groups, pending }: { groups: { label: string; items: { key: NavKey; href: string; label: string }[] }[]; pending: number }) {
  const pathname = usePathname();
  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = ICONS[item.key];
                const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={active} tooltip={item.label} render={<Link href={item.href} />}>
                      <Icon /> <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.key === 'review' && pending > 0 && <SidebarMenuBadge>{pending}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
