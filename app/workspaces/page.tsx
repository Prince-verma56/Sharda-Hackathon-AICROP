import { Manrope } from 'next/font/google';
import { redirect } from 'next/navigation';
import { HandHeart, LogOut, Plus, ShieldCheck, Sprout } from 'lucide-react';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { LeafMark } from '@/components/marketing/home/brand';
import { brand } from '@/config/brand';
import { getIdentity, workspacesFor } from '@/server/auth/dal';
import { chooseWorkspace, enableFarmerWorkspace } from '@/server/auth/workspace-actions';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata = { title: 'Choose workspace', robots: { index: false } };

const CARDS = {
  farmer: { icon: Sprout, title: 'किसान / Farmer', text: 'Check crops, talk to Mitra, see your reports' },
  volunteer: { icon: HandHeart, title: 'स्वयंसेवक / Volunteer', text: 'Campaigns, farmer visits and training' },
  admin: { icon: ShieldCheck, title: 'प्रशासक / Admin', text: 'Manage the platform and review diagnoses' },
} as const;

/** Workspace chooser for accounts with several roles (only workspaces granted in the database). */
export default async function WorkspacesPage() {
  const identity = await getIdentity();
  if (identity.state !== 'ok') redirect('/auth/continue');
  const spaces = workspacesFor(identity.user);
  if (spaces.length <= 1 && identity.user.roles.includes('FARMER')) redirect('/auth/continue');
  const canStartFarmer = !identity.user.roles.includes('FARMER');
  const startFarmer = enableFarmerWorkspace.bind(null, null);
  const card = 'flex w-full items-center gap-4 rounded-3xl bg-white p-5 text-left ring-1 ring-border transition hover:ring-[var(--crop-green-500)]';

  return (
    <div className={`theme-crop ${manrope.variable} flex min-h-dvh flex-1 flex-col items-center bg-[var(--crop-cream)] px-5 py-12 font-[family-name:var(--font-manrope)]`}>
      <span className="flex items-center gap-2 text-2xl font-bold tracking-tight"><LeafMark className="text-[var(--crop-green-600)]" /> {brand.name}</span>
      <p className="mt-1 text-sm text-muted-foreground">Choose where you want to go · कहाँ जाना है चुनें</p>
      <div className="mt-8 grid w-full max-w-md gap-3">
        {spaces.map((space) => {
          const c = CARDS[space];
          return (
            <form key={space} action={chooseWorkspace}>
              <input type="hidden" name="workspace" value={space} />
              <button type="submit" className={card}>
                <span className="grid size-14 place-items-center rounded-2xl bg-[var(--crop-green-100)] text-[var(--crop-green-800)]"><c.icon className="size-7" /></span>
                <span><b className="block text-lg">{c.title}</b><span className="text-sm text-muted-foreground">{c.text}</span></span>
              </button>
            </form>
          );
        })}
        {canStartFarmer && (
          <form action={startFarmer}>
            <button type="submit" className={`${card} border border-dashed border-[var(--crop-green-500)] ring-0`}>
              <span className="grid size-14 place-items-center rounded-2xl bg-white text-[var(--crop-green-800)] ring-1 ring-border"><Plus className="size-7" /></span>
              <span><b className="block text-lg">Start using the farmer app</b><span className="text-sm text-muted-foreground">किसान ऐप शुरू करें — check your own crops</span></span>
            </button>
          </form>
        )}
        <SignOutButton className="mt-2 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-white">
          <LogOut className="size-4" /> Sign out · लॉग आउट
        </SignOutButton>
      </div>
    </div>
  );
}
