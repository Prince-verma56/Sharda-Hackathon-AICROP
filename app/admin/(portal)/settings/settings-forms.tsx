'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MITRA_SETTING_GROUPS } from '@/lib/mitra/settings-options';
import { createRoleInvitation, updateMitraDefaults, updateSettings, type ActionState } from '@/server/admin/actions';
import type { PlatformSettings } from '@/server/cropai/settings';

/**
 * Wraps a server action for useActionState: if the call itself fails (most often a page opened
 * before a deploy / dev rebuild, whose action id no longer exists), show a clear message instead
 * of failing silently.
 */
function reportFailures(action: (prev: ActionState, form: FormData) => Promise<ActionState>) {
  return async (prev: ActionState, form: FormData): Promise<ActionState> => {
    try {
      return await action(prev, form);
    } catch {
      return { error: 'Could not reach the server — this page is out of date. Refresh the page (Ctrl+F5) and try again.' };
    }
  };
}

export function PlatformSettingsForm({ values }: { values: PlatformSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reportFailures(updateSettings), {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5"><Label htmlFor="ret">Photo retention (days)</Label><Input id="ret" name="image_retention_days" type="number" min={7} max={730} defaultValue={values.image_retention_days} className="w-40 bg-white" /><span className="text-xs text-muted-foreground">Applies to new uploads; photos are stored without EXIF/GPS metadata.</span></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="auto_queue_uncertain_for_review" defaultChecked={values.auto_queue_uncertain_for_review} className="size-4" /> Automatically queue results with model advisories for expert review</label>
      <div className="flex flex-col gap-1.5"><Label htmlFor="sup">Support contact shown to farmers</Label><Input id="sup" name="support_contact" defaultValue={values.support_contact} maxLength={120} placeholder="e.g. KVK helpline 1800-180-1551" className="bg-white" /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="notice">Farmer home notice</Label><Textarea id="notice" name="farmer_notice" defaultValue={values.farmer_notice} maxLength={280} rows={2} /></div>
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      {state.ok && <Alert><AlertDescription>{state.ok}</AlertDescription></Alert>}
      <Button type="submit" disabled={pending} className="w-fit">{pending && <Loader2 className="animate-spin" />}Save settings</Button>
    </form>
  );
}

/** Invite by mobile number. role=VOLUNTEER (admins) or ADMIN (super admins only, enforced server-side). */
export function InviteForm({ role, allowAdmin = false }: { role: 'VOLUNTEER' | 'ADMIN'; allowAdmin?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reportFailures(createRoleInvitation), {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="role" value={role} />
      <div className="flex flex-wrap gap-2">
        <Input name="phone" required inputMode="tel" placeholder="Mobile number, e.g. 98765 43210" className="h-9 w-64 bg-white" />
        {role === 'ADMIN' && allowAdmin && (
          <select name="adminLevel" className="h-9 rounded-lg border border-input bg-white px-2 text-sm" defaultValue="REVIEWER">
            <option value="ADMIN">Administrator</option>
            <option value="AGRONOMIST">Agronomist</option>
            <option value="REVIEWER">Reviewer</option>
            <option value="ANALYST">Analyst</option>
          </select>
        )}
        {role === 'VOLUNTEER' && <Input name="serviceArea" placeholder="Service area (village / block / district)" className="h-9 w-72 bg-white" />}
        <Button type="submit" size="sm" className="h-9" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Invite {role === 'ADMIN' ? 'admin' : 'volunteer'}</Button>
      </div>
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      {state.ok && <Alert><AlertDescription>{state.ok}</AlertDescription></Alert>}
    </form>
  );
}

/** Mitra defaults (language, tone, voice, pace, length) + extra guidance appended to Mitra's prompt. */
export function MitraDefaultsForm({ values }: { values: Record<'language' | 'tone' | 'voice' | 'pace' | 'length', string> & { extraInstructions: string } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reportFailures(updateMitraDefaults), {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MITRA_SETTING_GROUPS.map((group) => (
          <div key={group.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`mitra-${group.key}`}>{group.title.en}</Label>
            <select id={`mitra-${group.key}`} name={group.key} defaultValue={values[group.key]} className="h-9 rounded-lg border border-input bg-white px-2 text-sm">
              {group.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label.en} — {o.hint.en}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mitra-extra">Extra guidance for Mitra (optional)</Label>
        <Textarea
          id="mitra-extra"
          name="extraInstructions"
          defaultValue={values.extraInstructions}
          maxLength={800}
          rows={4}
          placeholder="e.g. Farmers here mostly grow wheat, mustard and potato. Mention the local KVK helpline when suggesting expert help."
        />
        <span className="text-xs text-muted-foreground">Added to Mitra’s instructions for voice and chat. It can never override the safety rules (no invented diseases, chemicals or doses).</span>
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
      <Button type="submit" disabled={pending} className="w-fit">
        {pending && <Loader2 className="animate-spin" />}Save Mitra defaults
      </Button>
    </form>
  );
}
