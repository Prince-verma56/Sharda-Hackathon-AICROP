import { redirect } from 'next/navigation';
import { firstParam, loginUrl, parseWorkspace, safeNextPath } from '@/lib/auth/redirects';

/**
 * /signup is an alias: new and returning users use the same phone + OTP page (/login).
 * A new number is registered automatically after its OTP is verified.
 */
export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  redirect(loginUrl({ role: parseWorkspace(firstParam(params.role)), next: safeNextPath(firstParam(params.next)) }));
}
