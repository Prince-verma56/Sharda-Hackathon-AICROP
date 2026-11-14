'use client';

import { useActionState, useState } from 'react';
import { Copy, Loader2, Share2 } from 'lucide-react';
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

/**
 * Invite by mobile number. role=VOLUNTEER (admins) or ADMIN (super admins only, enforced
 * server-side). Volunteer invitations return a one-time link to copy or share; SMS delivery is
 * not offered because no messaging provider is configured (Twilio Verify is for OTP only).
 */
export function InviteForm({ role, allowAdmin = false }: { role: 'VOLUNTEER' | 'ADMIN'; allowAdmin?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reportFailures(createRoleInvitation), {});
  const link = (state.data as { link?: string } | undefined)?.link;
  const [copied, setCopied] = useState(false);
  const field = 'h-10 bg-white';
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="role" value={role} />
      <div className="grid gap-3 sm:grid-cols-[7rem_1fr] lg:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`cc-${role}`}>Country</Label>
          <select id={`cc-${role}`} name="countryCode" defaultValue="+91" className="h-10 rounded-lg border border-input bg-white px-2 text-sm">
            <option value="+91">+91 India</option>
            <option value="+977">+977 Nepal</option>
            <option value="+880">+880 Bangladesh</option>
            <option value="+94">+94 Sri Lanka</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`phone-${role}`}>Mobile number *</Label>
          <Input id={`phone-${role}`} name="phone" required inputMode="tel" placeholder="98765 43210" className={field} />
        </div>
        {role === 'VOLUNTEER' && (
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="invitee-name">Name (optional)</Label>
            <Input id="invitee-name" name="inviteeName" maxLength={80} placeholder="e.g. Sunita Devi" className={field} />
          </div>
        )}
      </div>
      {role === 'VOLUNTEER' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="service-area">Service area</Label>
            <Input id="service-area" name="serviceArea" maxLength={120} placeholder="Block or cluster" className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="district">District (optional)</Label>
            <Input id="district" name="district" maxLength={60} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="village">Village (optional)</Label>
            <Input id="village" name="village" maxLength={80} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expires">Invitation valid for</Label>
            <select id="expires" name="expiresInDays" defaultValue="14" className="h-10 rounded-lg border border-input bg-white px-2 text-sm">
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </div>
        </div>
      )}
      {role === 'ADMIN' && allowAdmin && (
        <div className="flex flex-col gap-1.5 sm:w-64">
          <Label htmlFor="admin-level">Admin level</Label>
          <select id="admin-level" name="adminLevel" className="h-10 rounded-lg border border-input bg-white px-2 text-sm" defaultValue="REVIEWER">
            <option value="ADMIN">Administrator</option>
            <option value="AGRONOMIST">Agronomist</option>
            <option value="REVIEWER">Reviewer</option>
            <option value="ANALYST">Analyst</option>
          </select>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-10" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {role === 'ADMIN' ? 'Invite admin' : 'Send invitation'}
        </Button>
        {role === 'VOLUNTEER' && <span className="text-xs text-muted-foreground">Delivery: share link · SMS invitations need a messaging provider (not configured)</span>}
      </div>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.ok && (
        <Alert>
          <AlertDescription className="flex flex-col gap-3">
            <span>{state.ok}</span>
            {link && (
              <span className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">{link}</code>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(link).catch(() => undefined);
                      setCopied(true);
                    }}
                  >
                    <Copy /> {copied ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigator.share
                        ? navigator.share({ title: 'CropAI volunteer invitation', text: 'You are invited to volunteer with CropAI. Open this link and verify your phone number:', url: link }).catch(() => undefined)
                        : window.open(`https://wa.me/?text=${encodeURIComponent(`You are invited to volunteer with CropAI: ${link}`)}`, '_blank', 'noopener')
                    }
                  >
                    <Share2 /> Share
                  </Button>
                </span>
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}
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
