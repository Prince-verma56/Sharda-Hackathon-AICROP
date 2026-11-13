import { redirect } from 'next/navigation';

/** Old URL. Administrators use the common phone-OTP login (Admin tab); access comes from database roles. */
export default function AdminLoginRedirect() {
  redirect('/login?role=admin&next=/admin');
}
