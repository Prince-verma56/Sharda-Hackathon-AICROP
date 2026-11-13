import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export const metadata = { title: 'No access', robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <div className="theme-crop grid min-h-dvh flex-1 place-items-center px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <ShieldAlert className="size-12 text-[var(--crop-green-600)]" />
        <h1 className="text-2xl font-semibold">You don&apos;t have access to this page</h1>
        <p className="text-sm text-muted-foreground">Your staff role does not include this permission. Ask a super admin if you need it.</p>
        <Link href="/admin" className={buttonVariants()}>Back to overview</Link>
      </div>
    </div>
  );
}
