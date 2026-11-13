/** GET /api/v1/auth/me — the authenticated identity and its database roles (cookie or Bearer). */
import { getIdentity, workspacesFor } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { fail, ok } from '@/server/http/respond';

export async function GET() {
  const identity = await getIdentity();
  if (identity.state === 'suspended') return fail('ACCOUNT_BLOCKED', 403, 'This account cannot sign in.', { status: identity.status });
  if (identity.state !== 'ok') return fail('UNAUTHORIZED', 401, 'Sign in with your mobile number.');
  const { user } = identity;
  return ok({
    userId: user.userId,
    phone: user.phone,
    phoneMasked: maskPhone(user.phone),
    name: user.name,
    roles: user.roles,
    adminRole: user.adminRole,
    workspaces: workspacesFor(user),
    activeWorkspace: user.activeWorkspace,
    farmer: user.farmer,
    volunteer: user.volunteer,
  });
}
