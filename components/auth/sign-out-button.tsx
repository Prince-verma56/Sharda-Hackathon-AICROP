import { signOut } from '@/server/auth/account-actions';

/** Logout as a plain form POST to a server action (works without client JavaScript). */
export function SignOutButton({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <form action={signOut} className="contents">
      <button type="submit" className={className} title={title}>
        {children}
      </button>
    </form>
  );
}
