import { WorkspaceMenu } from '@/components/workspace/workspace-menu';
import { requireFarmer } from '@/server/auth/dal';
import { BottomNav, FarmerHeader } from './farmer-nav';

/**
 * Farmer app shell, in the public site's design: the site-style top header on every screen size,
 * plus bottom navigation on phones (the same flow the Flutter app will use). Pages size themselves.
 */
export default async function FarmerAppLayout({ children }: { children: React.ReactNode }) {
  const farmer = await requireFarmer();
  const lang = farmer.language === 'hi' ? 'hi' : 'en';
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <FarmerHeader lang={lang}>
        <WorkspaceMenu current="farmer" lang={lang} hideWhenSingle className="h-9 px-3 text-xs" />
      </FarmerHeader>
      <main className="flex flex-1 flex-col">{children}</main>
      <BottomNav lang={lang} />
    </div>
  );
}
