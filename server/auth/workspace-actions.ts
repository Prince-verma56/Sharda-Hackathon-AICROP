'use server';

import { redirect } from 'next/navigation';
import { safeNextPath, workspaceForPath, WORKSPACE_HOME, type Workspace } from '@/lib/auth/redirects';
import { auditService } from '@/server/audit';
import { db } from '@/server/db';
import { getAppUser, loginLanguage, workspacesFor } from './dal';

async function remember(userId: string, workspace: Workspace) {
  await db.user.update({ where: { id: userId }, data: { activeWorkspace: workspace } });
}

/** Workspace chooser form (/workspaces) — only among the roles the user actually has. */
export async function chooseWorkspace(form: FormData) {
  await switchWorkspace(String(form.get('workspace') ?? '') as Workspace);
}

/** Header switcher. Never grants anything: unknown or unassigned workspaces are refused. */
export async function switchWorkspace(workspace: Workspace) {
  const user = await getAppUser();
  if (!user) redirect('/login');
  if (!workspacesFor(user).includes(workspace)) redirect('/workspaces');
  await remember(user.userId, workspace);
  redirect(WORKSPACE_HOME[workspace]);
}

/**
 * "Start using the farmer app" for a signed-in account without the FARMER role (e.g. an
 * invited volunteer or admin). FARMER is the public default role every verified number gets,
 * so this is not an escalation. VOLUNTEER and ADMIN can only come from invitations.
 */
export async function enableFarmerWorkspace(next?: string | null) {
  const user = await getAppUser();
  if (!user) redirect('/login');
  if (!user.roles.includes('FARMER')) {
    await db.$transaction([
      db.userRole.upsert({ where: { userId_role: { userId: user.userId, role: 'FARMER' } }, create: { userId: user.userId, role: 'FARMER' }, update: {} }),
      db.farmerProfile.upsert({ where: { userId: user.userId }, create: { userId: user.userId, language: await loginLanguage() }, update: {} }),
    ]);
    await auditService.audit({ actorId: user.userId, action: 'workspace.farmer_enabled', resource: 'user', resourceId: user.userId });
  }
  await remember(user.userId, 'farmer');
  const target = safeNextPath(next);
  redirect(target && workspaceForPath(target) === 'farmer' ? target : WORKSPACE_HOME.farmer);
}
