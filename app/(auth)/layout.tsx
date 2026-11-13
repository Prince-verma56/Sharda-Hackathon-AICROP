/**
 * Auth Layout — CropAI uses a single phone + OTP login (Clerk) for every role.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-1 flex-col">{children}</div>;
}
