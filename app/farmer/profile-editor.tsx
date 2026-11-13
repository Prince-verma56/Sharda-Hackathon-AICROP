'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, LocateFixed, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CropThumb } from '@/components/crops/crop-thumb';
import { cropName } from '@/lib/crops';
import { saveLangCookie } from '@/lib/i18n/lang-cookie';
import { cn } from '@/lib/utils';

export interface ProfileValues {
  preferredName: string;
  language: 'hi' | 'en';
  district: string;
  state: string;
  village: string;
  mainCrops: string[];
  location: { latitude: number; longitude: number; label: string | null } | null;
}

const L = {
  hi: {
    lang: 'आपकी भाषा',
    name: 'आपका नाम',
    namePh: 'जैसे: रमेश',
    loc: 'खेत की जगह',
    locHelp: 'सिर्फ़ मौसम की जानकारी के लिए',
    gps: 'मेरी जगह इस्तेमाल करें',
    search: 'गाँव या ज़िला खोजें',
    crops: 'आपकी मुख्य फसलें',
    cropsHelp: (n: number) => `8 तक चुनें · ${n} चुनी गईं`,
    findCrop: 'फसल खोजें',
    noCrop: 'कोई फसल नहीं मिली',
    optional: 'वैकल्पिक',
    saved: 'सेव हो गया',
    gpsFail: 'जगह नहीं मिल पाई। गाँव का नाम खोजें।',
    skip: 'छोड़ें',
    next: 'आगे',
    finish: 'शुरू करें',
    save: 'बदलाव सेव करें',
  },
  en: {
    lang: 'Your language',
    name: 'Your name',
    namePh: 'e.g. Ramesh',
    loc: 'Farm location',
    locHelp: 'Only used for local weather',
    gps: 'Use my location',
    search: 'Search village or district',
    crops: 'Your main crops',
    cropsHelp: (n: number) => `Choose up to 8 · ${n} selected`,
    findCrop: 'Find a crop',
    noCrop: 'No crop found',
    optional: 'Optional',
    saved: 'Saved',
    gpsFail: 'Could not get location. Search your village instead.',
    skip: 'Skip',
    next: 'Next',
    finish: 'Start',
    save: 'Save changes',
  },
};

export function ProfileEditor({
  initial,
  crops,
  mode,
  cropImages = {},
}: {
  initial: ProfileValues;
  crops: string[];
  mode: 'onboarding' | 'profile';
  /** real crop photos (getCropImages()) */
  cropImages?: Record<string, string>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [cropQuery, setCropQuery] = useState('');
  const [places, setPlaces] = useState<{ label: string; latitude: number; longitude: number; district: string | null; state: string | null }[]>([]);
  const [locating, setLocating] = useState(false);
  const lang = values.language;
  const l = lang === 'en' ? L.en : L.hi;

  // Selected crops first, then the rest; filtered by English or Hindi name.
  const visibleCrops = useMemo(() => {
    const q = cropQuery.trim().toLowerCase();
    const match = (id: string) => !q || cropName(id, 'en').toLowerCase().includes(q) || cropName(id, 'hi').includes(q) || id.includes(q);
    const chosen = crops.filter((id) => initial.mainCrops.includes(id));
    const rest = crops.filter((id) => !initial.mainCrops.includes(id));
    return [...chosen, ...rest].filter(match);
  }, [crops, cropQuery, initial.mainCrops]);

  async function save(complete: boolean) {
    setBusy(true);
    const res = await fetch('/api/v1/farmer/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferredName: values.preferredName || null,
        language: values.language,
        district: values.district || null,
        state: values.state || null,
        village: values.village || null,
        mainCrops: values.mainCrops,
        location: values.location,
        ...(complete ? { complete: true } : {}),
      }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({ success: false }));
    if (!body.success) return toast.error(body.error?.message ?? 'Error');
    saveLangCookie(values.language);
    if (mode === 'onboarding') router.replace('/farmer');
    else toast.success(l.saved);
    router.refresh();
  }

  function locateMe() {
    if (!navigator.geolocation) return toast.error(l.gpsFail);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setValues((v) => ({ ...v, location: { latitude: Number(pos.coords.latitude.toFixed(4)), longitude: Number(pos.coords.longitude.toFixed(4)), label: v.village || v.district || 'GPS' } }));
      },
      () => {
        setLocating(false);
        toast.error(l.gpsFail);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  async function searchPlace() {
    if (query.trim().length < 2) return;
    const res = await fetch(`/api/v1/geo/search?q=${encodeURIComponent(query.trim())}`);
    const body = await res.json().catch(() => null);
    setPlaces(body?.success ? body.data.results : []);
  }

  const section = (n: number) => mode === 'profile' || step === n;
  const card = 'flex flex-col gap-4 rounded-[24px] bg-white p-5 ring-1 ring-border sm:p-6';

  return (
    <div className="flex flex-col gap-4">
      {mode === 'onboarding' && (
        <div className="flex gap-1.5" aria-hidden>
          {[1, 2, 3, 4].map((s) => (
            <span key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors', s <= step ? 'bg-[var(--crop-green-600)]' : 'bg-border')} />
          ))}
        </div>
      )}

      {section(1) && (
        <fieldset className={card}>
          <SectionTitle n={1} title={l.lang} lang={lang} />
          <div className="grid grid-cols-2 gap-3">
            {(['hi', 'en'] as const).map((lng) => {
              const on = values.language === lng;
              return (
                <button
                  key={lng}
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, language: lng }))}
                  aria-pressed={on}
                  className={cn(
                    'relative flex min-h-[4.5rem] items-center justify-center rounded-2xl text-xl font-semibold ring-1 transition-colors',
                    on ? 'bg-[var(--crop-green-100)] text-[var(--crop-green-900)] ring-2 ring-[var(--crop-green-600)]' : 'bg-[var(--crop-cream)] ring-border hover:bg-[var(--crop-green-100)]/60',
                  )}
                >
                  {lng === 'hi' ? 'हिंदी' : 'English'}
                  {on && (
                    <span className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-[var(--crop-green-600)] text-white">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {section(2) && (
        <label className={card}>
          <SectionTitle n={2} title={l.name} hint={l.optional} lang={lang} />
          <Input
            value={values.preferredName}
            onChange={(e) => setValues((v) => ({ ...v, preferredName: e.target.value }))}
            placeholder={l.namePh}
            maxLength={60}
            className="h-13 rounded-2xl bg-[var(--crop-cream)] text-lg"
          />
        </label>
      )}

      {section(3) && (
        <div className={card}>
          <SectionTitle n={3} title={l.loc} hint={l.locHelp} lang={lang} />
          {values.location && (
            <p className="flex items-center gap-2 rounded-2xl bg-[var(--crop-green-100)] px-4 py-3 text-sm font-medium text-[var(--crop-green-900)]">
              <MapPin className="size-4 shrink-0" /> {values.location.label ?? `${values.location.latitude}, ${values.location.longitude}`}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <Button type="button" variant="outline" className="h-13 rounded-2xl bg-white px-4 text-base" onClick={locateMe} disabled={locating}>
              {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />} {l.gps}
            </Button>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void searchPlace();
                  }
                }}
                placeholder={l.search}
                className="h-13 rounded-2xl bg-[var(--crop-cream)] text-base"
              />
              <Button type="button" size="icon-lg" className="size-13 shrink-0 rounded-2xl" onClick={searchPlace} aria-label={l.search}>
                <Search />
              </Button>
            </div>
          </div>
          {places.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {places.map((p) => (
                <li key={`${p.latitude},${p.longitude}`}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl bg-[var(--crop-cream)] px-4 py-3 text-left text-sm ring-1 ring-border hover:bg-[var(--crop-green-100)]"
                    onClick={() => {
                      setValues((v) => ({ ...v, location: { latitude: p.latitude, longitude: p.longitude, label: p.label }, district: p.district ?? v.district, state: p.state ?? v.state }));
                      setPlaces([]);
                      setQuery('');
                    }}
                  >
                    <MapPin className="size-4 shrink-0 text-[var(--crop-green-600)]" /> {p.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {section(4) && crops.length > 0 && (
        <div className={card}>
          <SectionTitle n={4} title={l.crops} hint={l.cropsHelp(values.mainCrops.length)} lang={lang} />
          {crops.length > 12 && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={cropQuery} onChange={(e) => setCropQuery(e.target.value)} placeholder={l.findCrop} aria-label={l.findCrop} className="h-11 rounded-2xl bg-[var(--crop-cream)] pl-10 text-base" />
            </div>
          )}
          <div className="max-h-[22rem] overflow-y-auto pr-1 [scrollbar-width:thin]">
            {visibleCrops.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{l.noCrop}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {visibleCrops.map((id) => {
                  const on = values.mainCrops.includes(id);
                  const full = !on && values.mainCrops.length >= 8;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        disabled={full}
                        onClick={() => setValues((v) => ({ ...v, mainCrops: on ? v.mainCrops.filter((c) => c !== id) : [...v.mainCrops, id] }))}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-2xl p-1.5 pr-3 text-left text-sm font-medium ring-1 transition-colors disabled:opacity-45',
                          on ? 'bg-[var(--crop-green-800)] text-white ring-[var(--crop-green-800)]' : 'bg-[var(--crop-cream)] ring-border hover:bg-[var(--crop-green-100)]',
                        )}
                      >
                        <CropThumb id={id} images={cropImages} size="md" />
                        <span className="min-w-0 flex-1 truncate">{cropName(id, lang)}</span>
                        {on && <Check className="size-4 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {mode === 'onboarding' ? (
        <div className="sticky bottom-4 grid grid-cols-[auto_1fr] gap-3">
          <Button type="button" variant="outline" className="h-14 rounded-2xl bg-white px-5" onClick={() => (step < 4 ? setStep(step + 1) : save(true))}>
            {l.skip}
          </Button>
          <Button type="button" className="h-14 rounded-2xl text-lg" disabled={busy} onClick={() => (step < 4 ? setStep(step + 1) : save(true))}>
            {busy && <Loader2 className="animate-spin" />} {step < 4 ? l.next : l.finish}
          </Button>
        </div>
      ) : (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex justify-end lg:bottom-4">
          <Button type="button" className="h-13 w-full rounded-2xl px-6 text-base shadow-[0_16px_32px_-16px_rgba(28,46,22,0.7)] sm:w-auto" disabled={busy} onClick={() => save(false)}>
            {busy && <Loader2 className="animate-spin" />} {l.save}
          </Button>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ n, title, hint, lang }: { n: number; title: string; hint?: string; lang: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="flex items-baseline gap-2.5">
        <span className="text-[11px] font-semibold tracking-[0.16em] text-[var(--crop-green-600)] tabular-nums">{String(n).padStart(2, '0')}</span>
        <span className={cn('text-lg font-semibold tracking-tight', lang !== 'hi' && 'sm:text-xl')}>{title}</span>
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
