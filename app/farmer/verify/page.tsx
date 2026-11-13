import { redirect } from 'next/navigation';

/** Old URL. OTP verification happens inside the common /login flow. */
export default function FarmerVerifyRedirect() {
  redirect('/login?role=farmer&next=/farmer');
}
