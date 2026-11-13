import { redirect } from 'next/navigation';

/** Old URL — account creation lives at /signup (same phone + OTP flow as /login). */
export default function RegisterPage() {
  redirect('/signup');
}
