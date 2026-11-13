/** GET /api/v1/auth/workspaces — workspaces the signed-in account may open (from database roles). */
import { WORKSPACE_HOME } from '@/lib/auth/redirects';
import { getAppUser, workspacesFor } from '@/server/auth/dal';
import { fail, ok } from '@/server/http/respond';

export async function GET() {
  const user = await getAppUser();
  if (!user) return fail('UNAUTHORIZED', 401, 'Sign in with your mobile number.');
  const workspaces = workspacesFor(user);
  return ok({
    workspaces: workspaces.map((id) => ({ id, home: WORKSPACE_HOME[id] })),
    activeWorkspace: user.activeWorkspace && workspaces.includes(user.activeWorkspace as never) ? user.activeWorkspace : null,
  });
}
