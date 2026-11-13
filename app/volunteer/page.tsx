import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BadgeCheck, GraduationCap, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireVolunteer } from '@/server/auth/dal';

export const metadata = { title: 'Home' };

const VERIFICATION = { PENDING: 'Awaiting admin verification', VERIFIED: 'Verified volunteer', SUSPENDED: 'Suspended' } as Record<string, string>;
const TRAINING = { NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', COMPLETED: 'Completed' } as Record<string, string>;

/** Volunteer home. Only real fields are shown; campaigns, visits and videos arrive with the volunteer programme module. */
export default async function VolunteerHome() {
  const volunteer = await requireVolunteer();
  if (!volunteer.profileComplete) redirect('/volunteer/profile');
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">नमस्ते{volunteer.name ? ` ${volunteer.name}` : ''}!</h1>
        <p className="text-sm text-muted-foreground">Thank you for helping farmers use CropAI.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl"><CardContent className="flex flex-col gap-1"><MapPin className="size-5 text-[var(--crop-green-600)]" /><span className="text-xs text-muted-foreground">Assigned area</span><b>{volunteer.serviceArea ?? '—'}</b></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="flex flex-col gap-1"><BadgeCheck className="size-5 text-[var(--crop-green-600)]" /><span className="text-xs text-muted-foreground">Status</span><b>{VERIFICATION[volunteer.verificationStatus] ?? volunteer.verificationStatus}</b></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="flex flex-col gap-1"><GraduationCap className="size-5 text-[var(--crop-green-600)]" /><span className="text-xs text-muted-foreground">Training</span><b>{TRAINING[volunteer.trainingStatus] ?? volunteer.trainingStatus}</b></CardContent></Card>
      </div>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle>What you can do now</CardTitle><CardDescription>Help farmers sign in with their own mobile number and take their first crop photo. Never use a farmer’s phone or OTP on their behalf.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <Link href="/how-it-works" className="font-medium text-[var(--crop-green-800)] underline">How CropAI works (show farmers)</Link>
          <Link href="/insights" className="font-medium text-[var(--crop-green-800)] underline">What the AI can and cannot do</Link>
        </CardContent>
      </Card>
    </div>
  );
}
