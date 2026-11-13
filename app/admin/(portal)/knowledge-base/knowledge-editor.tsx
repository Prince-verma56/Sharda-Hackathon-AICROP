'use client';

import { useActionState, useState } from 'react';
import { ExternalLink, Loader2, Search, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { researchSources, reviewKnowledge, saveKnowledge, type ActionState } from '@/server/admin/actions';

export interface EntryValues {
  id?: string;
  conditionLabel: string;
  title: string;
  summary: string;
  symptoms: string[];
  causes: string[];
  inspectionSteps: string[];
  prevention: string[];
  approvedTreatment: string[];
  furtherTesting: string[];
  regions: string[];
  sourceUrl: string;
  sourceOrganisation: string;
  referenceImageCredit: string;
  hasReferenceImage: boolean;
}

type Group = { crop: string; name: string; classes: { label: string; name: string }[] };

const LIST_FIELDS: [keyof EntryValues, string, string][] = [
  ['symptoms', 'Typical symptoms', 'One per line — general information shown as "common symptoms"'],
  ['causes', 'Causes / favourable conditions', 'One per line'],
  ['inspectionSteps', 'Inspection steps for the farmer', 'One per line — simple, observable actions'],
  ['prevention', 'Prevention (prefer non-chemical)', 'One per line'],
  ['approvedTreatment', 'Locally approved treatment (optional)', 'Only from an applicable approved reference. Include product/dose exactly as in the source.'],
  ['furtherTesting', 'Further testing', 'One per line, e.g. lab test via KVK'],
  ['regions', 'Region applicability', 'One per line, e.g. Maharashtra'],
];

export function KnowledgeEditor({ initial, groups, canEdit, canApprove, canResearch, status }: { initial: EntryValues; groups: Group[]; canEdit: boolean; canApprove: boolean; canResearch: boolean; status?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveKnowledge, {});
  const [review, reviewAction, reviewing] = useActionState<ActionState, FormData>(reviewKnowledge, {});
  const [research, researchAction, researchingState] = useActionState<ActionState, FormData>(researchSources, {});
  const [label, setLabel] = useState(initial.conditionLabel);
  const [sourceUrl, setSourceUrl] = useState(initial.sourceUrl);
  const [sourceOrg, setSourceOrg] = useState(initial.sourceOrganisation);
  const results = (research.data as { results?: { title: string; url: string; snippet: string; site: string; trusted: boolean }[] })?.results;
  const excerpt = (research.data as { excerpt?: { url: string; title: string | null; excerpt: string } })?.excerpt;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Entry</CardTitle><CardDescription>Saving sends the entry to review. Farmers only see approved entries.</CardDescription></CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-4">
            {initial.id && <input type="hidden" name="id" value={initial.id} />}
            <fieldset disabled={!canEdit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="conditionLabel">Model condition</Label>
                <select id="conditionLabel" name="conditionLabel" required value={label} onChange={(e) => setLabel(e.target.value)} className="h-10 rounded-lg border border-input bg-white px-2 text-sm">
                  <option value="" disabled>Choose a crop condition the model supports…</option>
                  {groups.map((g) => (
                    <optgroup key={g.crop} label={g.name}>
                      {g.classes.map((c) => <option key={c.label} value={c.label}>{g.name} · {c.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="title">Title</Label><Input id="title" name="title" defaultValue={initial.title} required maxLength={160} className="bg-white" /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="summary">Plain-language summary</Label><Textarea id="summary" name="summary" defaultValue={initial.summary} required rows={3} maxLength={2000} /></div>
              {LIST_FIELDS.map(([name, title, hint]) => (
                <div key={name} className="flex flex-col gap-1.5">
                  <Label htmlFor={name}>{title}</Label>
                  <Textarea id={name} name={name} defaultValue={(initial[name] as string[]).join('\n')} rows={3} />
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </div>
              ))}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5"><Label htmlFor="sourceUrl">Source URL</Label><Input id="sourceUrl" name="sourceUrl" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" className="bg-white" /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="sourceOrganisation">Source organisation</Label><Input id="sourceOrganisation" name="sourceOrganisation" value={sourceOrg} onChange={(e) => setSourceOrg(e.target.value)} placeholder="e.g. ICAR / TNAU Agritech" className="bg-white" /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5"><Label htmlFor="referenceImage">Reference photo {initial.hasReferenceImage && <Badge variant="secondary">uploaded</Badge>}</Label><Input id="referenceImage" name="referenceImage" type="file" accept="image/jpeg,image/png,image/webp" className="bg-white" /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="referenceImageCredit">Photo credit / licence</Label><Input id="referenceImageCredit" name="referenceImageCredit" defaultValue={initial.referenceImageCredit} placeholder="e.g. TNAU, CC BY 4.0" className="bg-white" /></div>
              </div>
            </fieldset>
            {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
            {state.ok && <Alert><AlertDescription>{state.ok}</AlertDescription></Alert>}
            {canEdit && <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save for review</Button>}
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {initial.id && canApprove && (
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-[var(--crop-green-600)]" /> Expert approval</CardTitle><CardDescription>Current status: {status?.replace('_', ' ').toLowerCase()}</CardDescription></CardHeader>
            <CardContent>
              <form action={reviewAction} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={initial.id} />
                <Textarea name="reviewNote" rows={2} placeholder="Review note (optional)" />
                <div className="grid grid-cols-2 gap-2">
                  <Button type="submit" name="decision" value="APPROVED" disabled={reviewing}>Approve</Button>
                  <Button type="submit" name="decision" value="REJECTED" variant="destructive" disabled={reviewing}>Reject</Button>
                </div>
                {review.error && <Alert variant="destructive"><AlertDescription>{review.error}</AlertDescription></Alert>}
                {review.ok && <Alert><AlertDescription>{review.ok}</AlertDescription></Alert>}
              </form>
            </CardContent>
          </Card>
        )}

        {canResearch && (
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Search className="size-5 text-[var(--crop-green-600)]" /> Find sources</CardTitle><CardDescription>Web search via TinyFish. Results are leads for experts — verify before citing.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <form action={researchAction}>
                <input type="hidden" name="conditionLabel" value={label} />
                <Button type="submit" variant="outline" className="w-full bg-white" disabled={!label || researchingState}>{researchingState && <Loader2 className="animate-spin" />}Search sources for this condition</Button>
              </form>
              {research.error && <Alert variant="destructive"><AlertDescription>{research.error}</AlertDescription></Alert>}
              {results?.map((r) => (
                <div key={r.url} className="rounded-lg border border-border bg-white p-3 text-sm">
                  <a href={r.url} target="_blank" rel="noreferrer" className="flex items-start gap-1 font-medium hover:underline">{r.title} <ExternalLink className="mt-0.5 size-3 shrink-0" /></a>
                  <p className="text-xs text-muted-foreground">{r.site} {r.trusted && <Badge variant="secondary" className="ml-1">institutional</Badge>}</p>
                  <p className="mt-1 text-xs">{r.snippet}</p>
                  <div className="mt-2 flex gap-2">
                    <Button type="button" size="xs" variant="outline" onClick={() => { setSourceUrl(r.url); setSourceOrg(r.site); }}>Use as source</Button>
                    <form action={researchAction}><input type="hidden" name="fetchUrl" value={r.url} /><Button type="submit" size="xs" variant="ghost">Read excerpt</Button></form>
                  </div>
                </div>
              ))}
              {excerpt && (
                <div className="max-h-80 overflow-y-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
                  <p className="mb-2 font-semibold">{excerpt.title ?? excerpt.url}</p>
                  {excerpt.excerpt}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
