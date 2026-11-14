'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { logActivity, type VolunteerFormState } from '@/server/volunteer/actions';

const field = 'h-11 rounded-2xl bg-[var(--crop-cream)] text-base';

export function ActivityForm({ campaigns, today }: { campaigns: { id: string; title: string }[]; today: string }) {
  const [state, action, pending] = useActionState<VolunteerFormState, FormData>(async (prev, form) => {
    try {
      return await logActivity(prev, form);
    } catch {
      return { error: 'Could not reach the server — refresh the page and try again.' };
    }
  }, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kind">What did you do? *</Label>
          <select id="kind" name="kind" required defaultValue="FIELD_VISIT" className="h-11 rounded-2xl border border-input bg-[var(--crop-cream)] px-3 text-base">
            <option value="FIELD_VISIT">Field visit</option>
            <option value="AWARENESS_SESSION">Awareness session</option>
            <option value="FARMER_ASSISTANCE">Helped farmers use CropAI</option>
            <option value="TRAINING">Attended training</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="occurredOn">Date *</Label>
          <Input id="occurredOn" name="occurredOn" type="date" required defaultValue={today} max={today} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="village">Village</Label>
          <Input id="village" name="village" maxLength={80} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="farmersReached">Farmers reached</Label>
          <Input id="farmersReached" name="farmersReached" type="number" min={0} max={5000} defaultValue={0} className={field} />
        </div>
      </div>
      {campaigns.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="campaignId">Campaign (optional)</Label>
          <select id="campaignId" name="campaignId" defaultValue="" className="h-11 rounded-2xl border border-input bg-[var(--crop-cream)] px-3 text-base">
            <option value="">No campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" maxLength={500} rows={3} placeholder="What went well, common crop problems you saw, questions farmers asked. Do not write farmers' names or phone numbers." className="rounded-2xl bg-[var(--crop-cream)]" />
      </div>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.ok && (
        <Alert>
          <AlertDescription>{state.ok}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending} className="h-12 w-full rounded-2xl text-base sm:w-fit sm:px-6">
        {pending && <Loader2 className="animate-spin" />}Save activity
      </Button>
    </form>
  );
}
