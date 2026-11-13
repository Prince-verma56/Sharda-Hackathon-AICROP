import { redirect } from 'next/navigation';

/** Old URL. Farmers use the common phone-OTP login (Farmer tab). */
export default function FarmerLoginRedirect() {
  redirect('/login?role=farmer&next=/farmer');
}
