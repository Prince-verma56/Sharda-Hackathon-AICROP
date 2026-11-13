'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveVolunteerProfile, type VolunteerFormState } from '@/server/volunteer/actions';

const LANGS = [['hi', 'हिंदी'], ['en', 'English'], ['mr', 'मराठी'], ['pa', 'ਪੰਜਾਬੀ'], ['bn', 'বাংলা'], ['te', 'తెలుగు'], ['ta', 'தமிழ்'], ['gu', 'ગુજરાતી'], ['kn', 'ಕನ್ನಡ'], ['ml', 'മലയാളം'], ['or', 'ଓଡ଼ିଆ']] as const;

export function VolunteerForm({ initial }: { initial: { name: string; serviceArea: string; district: string; state: string; languages: string[] } }) {
  const [state, action, pending] = useActionState<VolunteerFormState, FormData>(saveVolunteerProfile, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5"><Label htmlFor="name">Your name (shown to admins)</Label><Input id="name" name="name" defaultValue={initial.name} maxLength={80} className="h-11 bg-white" /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="serviceArea">Service area — villages or block you will visit *</Label><Input id="serviceArea" name="serviceArea" required defaultValue={initial.serviceArea} maxLength={120} className="h-11 bg-white" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5"><Label htmlFor="district">District *</Label><Input id="district" name="district" required defaultValue={initial.district} maxLength={60} className="h-11 bg-white" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="state">State *</Label><Input id="state" name="state" required defaultValue={initial.state} maxLength={60} className="h-11 bg-white" /></div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Languages you can teach in *</legend>
        <div className="flex flex-wrap gap-2">
          {LANGS.map(([value, label]) => (
            <label key={value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-3 text-sm ring-1 ring-border has-checked:bg-[var(--crop-green-100)] has-checked:ring-[var(--crop-green-500)]">
              <input type="checkbox" name="languages" value={value} defaultChecked={initial.languages.includes(value)} className="size-4" /> {label}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      <Button type="submit" disabled={pending} className="h-12 rounded-2xl">{pending && <Loader2 className="animate-spin" />}Save profile</Button>
    </form>
  );
}
