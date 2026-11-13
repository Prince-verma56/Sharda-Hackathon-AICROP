import { getAppUser, workspacesFor, type Workspace } from '@/server/auth/dal';
import { WorkspaceSwitcher } from './workspace-switcher';

/** Server wrapper: reads the signed-in account's workspaces (database roles) for the switcher. */
export async function WorkspaceMenu({
  current,
  lang,
  className,
  hideWhenSingle = false,
}: {
  current: Workspace;
  lang?: 'en' | 'hi';
  className?: string;
  /** hide for single-workspace accounts (e.g. ordinary farmers) */
  hideWhenSingle?: boolean;
}) {
  const user = await getAppUser();
  if (!user) return null;
  const available = workspacesFor(user);
  const canStartFarmer = !user.roles.includes('FARMER');
  if (hideWhenSingle && available.length <= 1 && !canStartFarmer) return null;
  return <WorkspaceSwitcher current={current} available={available} canStartFarmer={canStartFarmer} lang={lang} className={className} />;
}
