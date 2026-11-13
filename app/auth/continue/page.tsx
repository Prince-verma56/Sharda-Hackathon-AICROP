import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { HandHeart, LogOut, ShieldAlert, ShieldCheck, Sprout } from 'lucide-react';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { LeafMark } from '@/components/marketing/home/brand';
import { buttonVariants } from '@/components/ui/button';
import { brand } from '@/config/brand';
import { firstParam, loginUrl, parseWorkspace, resolveDestination, safeNextPath, WORKSPACE_HOME, type Workspace } from '@/lib/auth/redirects';
import { authLang, authText } from '@/lib/i18n/auth';
import { cn } from '@/lib/utils';
import { getIdentity, loadIdentity, workspacesFor } from '@/server/auth/dal';
import { refreshInvitations } from '@/server/auth/identity';
import { isOwnerPhone } from '@/server/auth/owner';
import { enableFarmerWorkspace } from '@/server/auth/workspace-actions';
import { db } from '@/server/db';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata: Metadata = { title: `Signing in · ${brand.name}`, robots: { index: false } };

const ICONS = { farmer: Sprout, volunteer: HandHeart, admin: ShieldCheck } as const;

/**
 * Post-verification router: session -> database roles -> requested workspace (?role) and safe
 * destination (?next). Never grants anything: missing access is explained, not redirected.
 */
export default async function AuthContinuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requested = parseWorkspace(firstParam(params.role));
  const next = safeNextPath(firstParam(params.next));
  const t = authText(authLang((await cookies()).get('cropai_lang')?.value));

  let identity = await getIdentity();
  if (identity.state === 'signed_out') redirect(loginUrl({ role: requested, next }));
  if (identity.state === 'ok') {
    const added = await refreshInvitations(identity.user.userId, identity.user.phone);
    if (added.length) identity = await loadIdentity();
  }

  let available: Workspace[] = [];
  let denied: Workspace | null = null;
  let canStartFarmer = false;
  if (identity.state === 'ok') {
    available = workspacesFor(identity.user);
    canStartFarmer = !identity.user.roles.includes('FARMER');
    const destination = resolveDestination(available, requested, next, isOwnerPhone(identity.user.phone) ? 'admin' : null);
    if (destination.kind === 'redirect') {
      if (identity.user.activeWorkspace !== destination.workspace) {
        await db.user.update({ where: { id: identity.user.userId }, data: { activeWorkspace: destination.workspace } });
      }
      // First visit: ask the role's details once (farmer onboarding is optional and skippable;
      // volunteers are sent to their required profile by the volunteer workspace itself).
      if (destination.to === '/farmer' && identity.user.farmer && !identity.user.farmer.onboarded) redirect('/farmer/onboarding');
      redirect(destination.to);
    }
    if (destination.kind === 'choose') redirect('/workspaces');
    if (destination.kind === 'denied') denied = destination.requested;
  }

  const title =
    identity.state === 'suspended'
      ? t.states[identity.status === 'SUSPENDED' ? 'suspended' : identity.status === 'PENDING' ? 'pending' : 'disabled']
      : identity.state === 'error'
        ? (t.states[identity.code as keyof typeof t.states] ?? t.states.generic)
        : denied
          ? t.denied[denied].title
          : t.noWorkspace;
  const text = denied ? t.denied[denied].text : null;
  const startFarmer = enableFarmerWorkspace.bind(null, next);

  return (
    <div className={`theme-crop ${manrope.variable} grid min-h-dvh flex-1 place-items-center bg-[var(--crop-cream)] px-5 py-10 font-[family-name:var(--font-manrope)]`}>
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-[28px] bg-white p-7 text-center shadow-sm ring-1 ring-border">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold"><LeafMark className="size-6 text-[var(--crop-green-600)]" /> {brand.name}</Link>
        <span className="grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700"><ShieldAlert className="size-7" /></span>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {text && <p className="text-sm text-muted-foreground">{text}</p>}
        </div>

        <div className="flex w-full flex-col gap-2">
          {denied === 'farmer' && canStartFarmer && (
            <form action={startFarmer}>
              <button type="submit" className={cn(buttonVariants(), 'h-12 w-full rounded-2xl')}>
                <Sprout /> {t.startFarmer}
              </button>
            </form>
          )}
          {available.map((space) => {
            const Icon = ICONS[space];
            return (
              <Link key={space} href={WORKSPACE_HOME[space]} className={cn(buttonVariants({ variant: 'outline' }), 'h-12 rounded-2xl')}>
                <Icon /> {t.goTo(t.roles[space].workspace)}
              </Link>
            );
          })}
          <SignOutButton className={cn(buttonVariants({ variant: 'ghost' }), 'h-11 w-full rounded-2xl')}>
            <LogOut /> {t.signOut}
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
