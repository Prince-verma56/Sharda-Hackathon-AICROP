'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, LocateFixed, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cropEmoji, cropName } from '@/lib/crops';
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
  hi: { lang: 'आपकी भाषा', name: 'आपका नाम (वैकल्पिक)', namePh: 'जैसे: रमेश', loc: 'खेत की जगह (वैकल्पिक)', locHelp: 'मौसम की जानकारी के लिए', gps: 'मेरी जगह इस्तेमाल करें', search: 'गाँव या ज़िला खोजें', crops: 'आपकी मुख्य फसलें (वैकल्पिक)', saved: 'सेव हो गया', gpsFail: 'जगह नहीं मिल पाई। गाँव का नाम खोजें।', skip: 'छोड़ें', next: 'आगे', finish: 'शुरू करें', save: 'सेव करें', step: (n: number) => `चरण ${n}/4` },
  en: { lang: 'Your language', name: 'Your name (optional)', namePh: 'e.g. Ramesh', loc: 'Farm location (optional)', locHelp: 'Used for weather', gps: 'Use my location', search: 'Search village or district', crops: 'Your main crops (optional)', saved: 'Saved', gpsFail: 'Could not get location. Search your village instead.', skip: 'Skip', next: 'Next', finish: 'Start', save: 'Save', step: (n: number) => `Step ${n} of 4` },
};

export function ProfileEditor({ initial, crops, mode }: { initial: ProfileValues; crops: string[]; mode: 'onboarding' | 'profile' }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<{ label: string; latitude: number; longitude: number; district: string | null; state: string | null }[]>([]);
  const [locating, setLocating] = useState(false);
  const l = values.language === 'en' ? L.en : L.hi;

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

  function useGps() {
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

  return (
    <div className="flex flex-col gap-6">
      {mode === 'onboarding' && (
        <div className="flex gap-1.5">{[1, 2, 3, 4].map((s) => <span key={s} className={cn('h-1.5 flex-1 rounded-full', s <= step ? 'bg-[var(--crop-green-600)]' : 'bg-border')} />)}</div>
      )}

      {section(1) && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-xl font-semibold">{l.lang}</legend>
          <div className="grid grid-cols-2 gap-3">
            {(['hi', 'en'] as const).map((lng) => (
              <button key={lng} type="button" onClick={() => setValues((v) => ({ ...v, language: lng }))} aria-pressed={values.language === lng}
                className={cn('flex min-h-20 flex-col items-center justify-center rounded-2xl bg-white text-xl font-semibold ring-1 ring-border', values.language === lng && 'ring-2 ring-[var(--crop-green-600)]')}>
                {lng === 'hi' ? 'हिंदी' : 'English'}
                {values.language === lng && <Check className="size-5 text-[var(--crop-green-600)]" />}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {section(2) && (
        <label className="flex flex-col gap-2">
          <span className="text-xl font-semibold">{l.name}</span>
          <Input value={values.preferredName} onChange={(e) => setValues((v) => ({ ...v, preferredName: e.target.value }))} placeholder={l.namePh} maxLength={60} className="h-14 rounded-2xl bg-white text-lg" />
        </label>
      )}

      {section(3) && (
        <div className="flex flex-col gap-3">
          <span className="text-xl font-semibold">{l.loc}</span>
          <span className="-mt-2 text-sm text-muted-foreground">{l.locHelp}</span>
          {values.location && (
            <p className="flex items-center gap-2 rounded-2xl bg-[var(--crop-green-100)] px-4 py-3 text-sm text-[var(--crop-green-900)]"><MapPin className="size-4" /> {values.location.label ?? `${values.location.latitude}, ${values.location.longitude}`}</p>
          )}
          <Button type="button" variant="outline" className="h-14 rounded-2xl bg-white text-base" onClick={useGps} disabled={locating}>
            {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />} {l.gps}
          </Button>
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void searchPlace(); } }} placeholder={l.search} className="h-13 rounded-2xl bg-white text-base" />
            <Button type="button" size="icon-lg" className="size-13 rounded-2xl" onClick={searchPlace} aria-label={l.search}><Search /></Button>
          </div>
          {places.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {places.map((p) => (
                <li key={`${p.latitude},${p.longitude}`}>
                  <button type="button" className="w-full rounded-xl bg-white px-4 py-3 text-left text-sm ring-1 ring-border" onClick={() => { setValues((v) => ({ ...v, location: { latitude: p.latitude, longitude: p.longitude, label: p.label }, district: p.district ?? v.district, state: p.state ?? v.state })); setPlaces([]); setQuery(''); }}>
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {section(4) && (
        <div className="flex flex-col gap-3">
          <span className="text-xl font-semibold">{l.crops}</span>
          <div className="flex flex-wrap gap-2">
            {crops.map((id) => {
              const on = values.mainCrops.includes(id);
              return (
                <button key={id} type="button" aria-pressed={on}
                  onClick={() => setValues((v) => ({ ...v, mainCrops: on ? v.mainCrops.filter((c) => c !== id) : v.mainCrops.length < 8 ? [...v.mainCrops, id] : v.mainCrops }))}
                  className={cn('min-h-11 rounded-full px-3.5 text-sm font-medium ring-1 ring-border', on ? 'bg-[var(--crop-green-800)] text-white ring-0' : 'bg-white')}>
                  {cropEmoji(id)} {cropName(id, values.language)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === 'onboarding' ? (
        <div className="sticky bottom-4 grid grid-cols-[auto_1fr] gap-3">
          <Button type="button" variant="outline" className="h-14 rounded-2xl bg-white px-5" onClick={() => (step < 4 ? setStep(step + 1) : save(true))}>{l.skip}</Button>
          <Button type="button" className="h-14 rounded-2xl text-lg" disabled={busy} onClick={() => (step < 4 ? setStep(step + 1) : save(true))}>
            {busy && <Loader2 className="animate-spin" />} {step < 4 ? l.next : l.finish}
          </Button>
        </div>
      ) : (
        <Button type="button" className="h-14 rounded-2xl text-lg" disabled={busy} onClick={() => save(false)}>{busy && <Loader2 className="animate-spin" />} {l.save}</Button>
      )}
    </div>
  );
}
