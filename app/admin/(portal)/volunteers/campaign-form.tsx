'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ActionState } from '@/server/admin/actions';
import { createCampaign } from '@/server/admin/volunteer-actions';

export function CampaignForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    try {
      return await createCampaign(prev, form);
    } catch {
      return { error: 'Could not reach the server — refresh the page (Ctrl+F5) and try again.' };
    }
  }, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-title">Title *</Label>
          <Input id="c-title" name="title" required maxLength={120} placeholder="e.g. Rabi wheat rust awareness" className="h-10 bg-white" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-region">Region</Label>
          <Input id="c-region" name="region" maxLength={120} placeholder="District / block" className="h-10 bg-white" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="c-desc">What volunteers should do *</Label>
        <Textarea id="c-desc" name="description" required maxLength={1000} rows={3} placeholder="Goal, key message for farmers, what to report back." />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-start">Starts</Label>
          <Input id="c-start" name="startsOn" type="date" className="h-10 bg-white" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-end">Ends</Label>
          <Input id="c-end" name="endsOn" type="date" className="h-10 bg-white" />
        </div>
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
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}Create campaign
      </Button>
    </form>
  );
}
