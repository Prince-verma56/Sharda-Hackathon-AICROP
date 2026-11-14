'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveVolunteerProfile, type VolunteerFormState } from '@/server/volunteer/actions';

const LANGS = [['hi', 'हिंदी'], ['en', 'English'], ['mr', 'मराठी'], ['pa', 'ਪੰਜਾਬੀ'], ['bn', 'বাংলা'], ['te', 'తెలుగు'], ['ta', 'தமிழ்'], ['gu', 'ગુજરાતી'], ['kn', 'ಕನ್ನಡ'], ['ml', 'മലയാളം'], ['or', 'ଓଡ଼ିଆ']] as const;

const card = 'flex flex-col gap-4 rounded-[24px] bg-white p-5 ring-1 ring-border sm:p-6';
const field = 'h-12 rounded-2xl bg-[var(--crop-cream)] text-base';

function SectionTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="flex items-baseline gap-2.5">
        <span className="text-[11px] font-semibold tracking-[0.16em] text-[var(--crop-green-600)] tabular-nums">{String(n).padStart(2, '0')}</span>
        <span className="text-lg font-semibold tracking-tight sm:text-xl">{title}</span>
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function VolunteerForm({
  initial,
}: {
  initial: { name: string; serviceArea: string; district: string; state: string; languages: string[]; village: string; preferredLanguage: string; bio: string; availability: string };
}) {
  const [state, action, pending] = useActionState<VolunteerFormState, FormData>(saveVolunteerProfile, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className={card}>
        <SectionTitle n={1} title="About you" hint="Shown to admins" />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" defaultValue={initial.name} maxLength={80} className={field} />
        </div>
      </div>

      <div className={card}>
        <SectionTitle n={2} title="Where you work" hint="* required" />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="serviceArea">Service area — villages or block you will visit *</Label>
          <Input id="serviceArea" name="serviceArea" required defaultValue={initial.serviceArea} maxLength={120} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="village">Village (optional)</Label>
          <Input id="village" name="village" defaultValue={initial.village} maxLength={80} className={field} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="district">District *</Label>
            <Input id="district" name="district" required defaultValue={initial.district} maxLength={60} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="state">State *</Label>
            <Input id="state" name="state" required defaultValue={initial.state} maxLength={60} className={field} />
          </div>
        </div>
      </div>

      <fieldset className={card}>
        <legend className="sr-only">Languages you can teach in</legend>
        <SectionTitle n={3} title="Languages you can teach in" hint="Choose at least one *" />
        <div className="flex flex-wrap gap-2">
          {LANGS.map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-[var(--crop-cream)] px-4 text-sm font-medium ring-1 ring-border transition-colors has-checked:bg-[var(--crop-green-100)] has-checked:text-[var(--crop-green-900)] has-checked:ring-2 has-checked:ring-[var(--crop-green-600)]"
            >
              <input type="checkbox" name="languages" value={value} defaultChecked={initial.languages.includes(value)} className="size-4 accent-[var(--crop-green-600)]" /> {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={card}>
        <SectionTitle n={4} title="A little about you" hint="Optional" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preferredLanguage">App language</Label>
            <select id="preferredLanguage" name="preferredLanguage" defaultValue={initial.preferredLanguage} className="h-12 rounded-2xl border border-input bg-[var(--crop-cream)] px-3 text-base">
              <option value="">No preference</option>
              <option value="hi">हिंदी</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="availability">When are you available?</Label>
            <select id="availability" name="availability" defaultValue={initial.availability} className="h-12 rounded-2xl border border-input bg-[var(--crop-cream)] px-3 text-base">
              <option value="">Not specified</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekends">Weekends</option>
              <option value="mornings">Mornings</option>
              <option value="evenings">Evenings</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bio">Short introduction</Label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={initial.bio}
            maxLength={400}
            rows={3}
            placeholder="e.g. Agriculture graduate, farm in Dankaur, can teach in Hindi and Punjabi."
            className="w-full rounded-2xl bg-[var(--crop-cream)] px-4 py-3 text-base ring-1 ring-border outline-none focus:ring-2 focus:ring-[var(--crop-green-500)]"
          />
        </div>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="h-13 w-full rounded-2xl px-6 text-base sm:w-auto">
          {pending && <Loader2 className="animate-spin" />}Save profile
        </Button>
      </div>
    </form>
  );
}
