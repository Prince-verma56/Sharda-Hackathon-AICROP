'use client';

import { useActionState, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { submitReview, type ActionState } from '@/server/admin/actions';

export function ReviewForm({ diagnosisId, classes }: { diagnosisId: string; classes: { label: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitReview, {});
  const [verdict, setVerdict] = useState('CONFIRMED');
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="diagnosisId" value={diagnosisId} />
      <fieldset className="grid grid-cols-3 gap-2">
        <legend className="mb-2 text-sm font-medium">Your conclusion</legend>
        {[
          ['CONFIRMED', 'Confirm'],
          ['CHALLENGED', 'Challenge'],
          ['NEEDS_INFO', 'Need info'],
        ].map(([value, label]) => (
          <label key={value} className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-sm font-medium ${verdict === value ? 'border-[var(--crop-green-600)] bg-[var(--crop-green-100)]' : 'border-border bg-white'}`}>
            <input type="radio" name="verdict" value={value} checked={verdict === value} onChange={() => setVerdict(value)} className="sr-only" />
            {label}
          </label>
        ))}
      </fieldset>
      {verdict === 'CHALLENGED' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correctedLabel">Expert&apos;s condition (model-supported classes)</Label>
          <select id="correctedLabel" name="correctedLabel" className="h-9 rounded-lg border border-input bg-white px-2 text-sm">
            <option value="">Not sure / other</option>
            {classes.map((c) => <option key={c.label} value={c.label}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Review note (shown to the farmer)</Label>
        <Textarea id="note" name="note" required minLength={3} maxLength={2000} rows={4} placeholder="What you observed and what the farmer should do next." />
      </div>
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      {state.ok && <Alert><AlertDescription>{state.ok}</AlertDescription></Alert>}
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save review</Button>
    </form>
  );
}
