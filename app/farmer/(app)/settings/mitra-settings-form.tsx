'use client';

import { useState } from 'react';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import { LeafMark } from '@/components/marketing/home/brand';
import { MITRA_SETTING_GROUPS, type MitraSettingKey, type UiLang } from '@/lib/mitra/settings-options';
import { cn } from '@/lib/utils';

type Values = Record<MitraSettingKey, string>;

const TEXT = {
  en: { saved: 'Saved — used from your next message or call', failed: 'Could not save. Please try again.', default: 'Default', useDefault: 'Use default', preview: 'Preview', previewHint: 'How Mitra will start a reply' },
  hi: { saved: 'सेव हो गया — अगले संदेश या कॉल से लागू', failed: 'सेव नहीं हो सका। फिर कोशिश करें।', default: 'डिफ़ॉल्ट', useDefault: 'डिफ़ॉल्ट रखें', preview: 'झलक', previewHint: 'मित्र ऐसे जवाब शुरू करेगा' },
};

const GREETING: Record<string, Record<string, string>> = {
  hinglish: { friendly: 'Namaste Ramesh ji! Bataiye, aaj fasal mein kya dikh raha hai?', respectful: 'Namaste ji. Aap apni fasal ki samasya bataiye, main madad karunga.', expert: 'Namaste. Fasal, patte ka hissa aur daag ka rang bataiye.' },
  hi: { friendly: 'नमस्ते रमेश जी! बताइए, आज फसल में क्या दिख रहा है?', respectful: 'नमस्ते जी। आप अपनी फसल की समस्या बताइए, मैं मदद करूँगा।', expert: 'नमस्ते। फसल, पत्ती का हिस्सा और दाग का रंग बताइए।' },
  en: { friendly: 'Hi Ramesh! Tell me, what are you seeing on your crop today?', respectful: 'Namaste. Please tell me about your crop problem and I will help.', expert: 'Hello. Tell me the crop, the plant part and the colour of the spots.' },
};

export function MitraSettingsForm({ lang, initial, overrides, defaults }: { lang: UiLang; initial: Values; overrides: Partial<Values>; defaults: Values }) {
  const [values, setValues] = useState(initial);
  const [own, setOwn] = useState<Partial<Values>>(overrides);
  const [saving, setSaving] = useState<MitraSettingKey | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const t = TEXT[lang];

  async function save(key: MitraSettingKey, value: string | null) {
    const before = { values, own };
    setSaving(key);
    setStatus(null);
    setValues((v) => ({ ...v, [key]: value ?? defaults[key] }));
    setOwn((o) => {
      const next = { ...o };
      if (value === null) delete next[key];
      else next[key] = value;
      return next;
    });
    const res = await fetch('/api/v1/assistant/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: value }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { success?: boolean; data?: { effective: Values; overrides: Partial<Values> } } | null;
    setSaving(null);
    if (body?.success && body.data) {
      setValues(body.data.effective);
      setOwn(body.data.overrides);
      setStatus({ ok: true, text: t.saved });
    } else {
      setValues(before.values);
      setOwn(before.own);
      setStatus({ ok: false, text: t.failed });
    }
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
      <div className="flex flex-col gap-4 lg:col-span-8">
        {MITRA_SETTING_GROUPS.map((group, index) => (
          <fieldset key={group.key} className="flex flex-col gap-4 rounded-[24px] bg-white p-5 ring-1 ring-border sm:p-6">
            <legend className="sr-only">{group.title[lang]}</legend>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-baseline gap-2.5">
                  <span className="text-[11px] font-semibold tracking-[0.16em] text-[var(--crop-green-600)] tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-lg font-semibold tracking-tight sm:text-xl">{group.title[lang]}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{group.help[lang]}</p>
              </div>
              {own[group.key] !== undefined && (
                <button
                  type="button"
                  onClick={() => void save(group.key, null)}
                  disabled={saving !== null}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--crop-green-800)] ring-1 ring-border hover:bg-[var(--crop-green-100)] disabled:opacity-50"
                >
                  <RotateCcw className="size-3.5" /> {t.useDefault}
                </button>
              )}
            </div>
            <div className={cn('grid gap-2.5', group.options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
              {group.options.map((option) => {
                const on = values[group.key] === option.value;
                const isDefault = defaults[group.key] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={on}
                    disabled={saving !== null}
                    onClick={() => !on && void save(group.key, option.value)}
                    className={cn(
                      'relative flex min-h-[5.25rem] flex-col items-start justify-between gap-2 rounded-2xl p-4 text-left ring-1 transition-colors disabled:cursor-wait',
                      on ? 'bg-[var(--crop-green-100)] ring-2 ring-[var(--crop-green-600)]' : 'bg-[var(--crop-cream)] ring-border hover:bg-[var(--crop-green-100)]/60',
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="text-base font-semibold">{option.label[lang]}</span>
                      {saving === group.key && on ? (
                        <Loader2 className="size-4 animate-spin text-[var(--crop-green-600)]" />
                      ) : on ? (
                        <span className="grid size-5 place-items-center rounded-full bg-[var(--crop-green-600)] text-white">
                          <Check className="size-3.5" />
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs leading-snug text-muted-foreground">{option.hint[lang]}</span>
                    {isDefault && <span className="text-[9px] font-semibold tracking-[0.14em] text-[var(--crop-green-600)] uppercase">{t.default}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <p aria-live="polite" className={cn('min-h-5 text-sm', status?.ok ? 'text-[var(--crop-green-800)]' : 'text-red-700')}>
          {status?.text}
        </p>
      </div>

      <aside className="relative overflow-hidden rounded-[28px] bg-[var(--crop-green-950)] p-5 text-white sm:p-6 lg:sticky lg:top-24 lg:col-span-4">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-[var(--crop-green-200)] uppercase">{t.preview}</p>
        <p className="mt-1 text-sm text-white/70">{t.previewHint}</p>
        <div className="mt-5 flex gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10">
            <LeafMark className="size-4 text-[var(--crop-green-200)]" />
          </span>
          <p className="rounded-2xl rounded-tl-md bg-white/10 px-4 py-3 text-[15px] leading-relaxed ring-1 ring-white/10">{GREETING[values.language]?.[values.tone] ?? GREETING.hinglish.friendly}</p>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 text-sm">
          {MITRA_SETTING_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col-reverse gap-0.5 bg-[var(--crop-green-950)] p-3 last:col-span-2">
              <dt className="text-[9px] font-semibold tracking-[0.14em] text-white/60 uppercase">{group.title[lang]}</dt>
              <dd className="font-semibold">{group.options.find((o) => o.value === values[group.key])?.label[lang]}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
