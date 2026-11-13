"use client";

import { useEffect, useState } from "react";
import {
  Apple,
  ArrowRight,
  Ban,
  Bug,
  CalendarDays,
  CalendarRange,
  CircleDot,
  CircleHelp,
  Clock,
  Cloud,
  CloudFog,
  CloudRain,
  FlaskConical,
  Flower2,
  Grid2x2,
  History,
  LayoutGrid,
  Leaf,
  Loader2,
  LocateFixed,
  MapPin,
  NotebookPen,
  Shrub,
  Sprout,
  Sun,
  Wheat,
  X,
} from "lucide-react";
import { eyebrowClass } from "@/components/app/page-intro";
import {
  answeredCount,
  FIELD_LABELS,
  FIELD_OPTIONS,
  type ChoiceKey,
  type FieldContext,
} from "@/lib/cropai/field-context";
import { cn } from "@/lib/utils";

type Icon = React.ComponentType<{ className?: string; strokeWidth?: number }>;

const ICONS: { [K in ChoiceKey]: Record<string, Icon> } = {
  cropStage: {
    seedling: Sprout,
    vegetative: Leaf,
    flowering: Flower2,
    fruiting: Apple,
    harvest: Wheat,
  },
  firstNoticed: {
    today: Sun,
    few_days: CalendarDays,
    week: CalendarRange,
    weeks: History,
  },
  spread: { few_plants: CircleDot, patches: Grid2x2, most_field: LayoutGrid },
  parts: {
    leaves: Leaf,
    stem: Shrub,
    fruit: Apple,
    flowers: Flower2,
    roots: Sprout,
  },
  recentWeather: {
    rain: CloudRain,
    dew_fog: CloudFog,
    hot_dry: Sun,
    normal: Cloud,
  },
  sprayed: {
    no: Ban,
    fungicide: FlaskConical,
    insecticide: Bug,
    fertilizer: Sprout,
    not_sure: CircleHelp,
  },
};

const QUESTIONS: ChoiceKey[] = [
  "cropStage",
  "firstNoticed",
  "spread",
  "parts",
  "recentWeather",
  "sprayed",
];

export interface FieldDetailsValue {
  context: FieldContext;
  saveFarmLocation: boolean;
}

type GeoState = "idle" | "locating" | "ok" | "denied" | "unavailable";

/**
 * Optional "field details" step: automatic date/time + device location (with permission), and
 * tap-to-choose answers that help the AI report and Mitra understand the field.
 */
export function FieldDetailsStep({
  lang,
  value,
  onChange,
  onSkip,
  onContinue,
  farmHasLocation,
  preview,
  header,
}: {
  lang: string;
  value: FieldDetailsValue;
  onChange: React.Dispatch<React.SetStateAction<FieldDetailsValue>>;
  onSkip: () => void;
  onContinue: () => void;
  farmHasLocation: boolean;
  preview: string | null;
  header: React.ReactNode;
}) {
  const hi = lang === "hi";
  const ui = hi ? "hi" : "en";
  const ctx = value.context;
  const [geo, setGeo] = useState<GeoState>(ctx.location ? "ok" : "idle");
  const [now] = useState(() => new Date());
  const set = (patch: Partial<FieldContext>) =>
    onChange((prev) => ({ ...prev, context: { ...prev.context, ...patch } }));

  function locate() {
    if (!("geolocation" in navigator)) return setGeo("unavailable");
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo("ok");
        onChange((prev) => ({
          ...prev,
          context: {
            ...prev.context,
            location: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracyM: pos.coords.accuracy,
            },
          },
        }));
      },
      (err) =>
        setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  // Location is requested once when the step opens (the browser asks for permission). Date/time
  // are stamped from the device when the check is sent.
  useEffect(() => {
    if (ctx.location || geo !== "idle") return;
    const timer = window.setTimeout(locate, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the step opens
  }, []);

  // Computed from the latest state (not this render), so quick taps never drop an answer.
  const toggle = (key: ChoiceKey, option: string) =>
    onChange((prev) => {
      const c = prev.context;
      if (key === "parts") {
        const parts = c.parts ?? [];
        const next = parts.includes(option as never)
          ? parts.filter((p) => p !== option)
          : [...parts, option as never];
        return { ...prev, context: { ...c, parts: next.length ? next : undefined } };
      }
      const current = c[key as Exclude<ChoiceKey, "parts">];
      return {
        ...prev,
        context: { ...c, [key]: current === option ? undefined : option } as FieldContext,
      };
    });
  const isOn = (key: ChoiceKey, option: string) =>
    key === "parts"
      ? (ctx.parts ?? []).includes(option as never)
      : ctx[key] === option;
  const answered = answeredCount(ctx);
  const tiny = cn(eyebrowClass(lang), "text-[var(--crop-green-600)]");

  return (
    <section className="mt-6 flex flex-col gap-5 lg:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {header}
        <button
          type="button"
          onClick={onSkip}
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {hi ? "छोड़ें — सीधे जांच करें" : "Skip — check without details"}
        </button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
        {/* Automatic context */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- local preview
            <img
              src={preview}
              alt=""
              className="aspect-[4/3] w-full rounded-[24px] object-cover"
            />
          )}
          <div className="flex flex-col gap-3 rounded-[24px] bg-white p-5 ring-1 ring-border">
            <p className={tiny}>
              {hi ? "अपने आप जोड़ा गया" : "Added automatically"}
            </p>
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--crop-cream)] p-3 ring-1 ring-border">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
                <Clock className="size-5" strokeWidth={1.7} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {now.toLocaleString(hi ? "hi-IN" : "en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--crop-cream)] p-3 ring-1 ring-border">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
                {geo === "locating" ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <MapPin className="size-5" strokeWidth={1.7} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {geo === "ok" && ctx.location
                    ? hi
                      ? "जगह जोड़ी गई"
                      : "Location added"
                    : geo === "locating"
                      ? hi
                        ? "जगह ढूँढ रहे हैं…"
                        : "Finding location…"
                      : geo === "denied"
                        ? hi
                          ? "जगह की अनुमति बंद है"
                          : "Location permission off"
                        : hi
                          ? "जगह नहीं मिली"
                          : "No location"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {geo === "ok" && ctx.location
                    ? `${ctx.location.latitude.toFixed(2)}, ${ctx.location.longitude.toFixed(2)} · ${hi ? "लगभग 1 किमी तक" : "rounded to ~1 km"}`
                    : hi
                      ? "मौसम की जानकारी के लिए (वैकल्पिक)"
                      : "Used for local weather (optional)"}
                </span>
              </span>
              {geo === "ok" && ctx.location ? (
                <button
                  type="button"
                  aria-label={hi ? "जगह हटाएँ" : "Remove location"}
                  onClick={() => (setGeo("idle"), set({ location: undefined }))}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-white"
                >
                  <X className="size-4" />
                </button>
              ) : geo !== "locating" ? (
                <button
                  type="button"
                  onClick={locate}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold ring-1 ring-border hover:bg-[var(--crop-green-100)]"
                >
                  <LocateFixed className="size-3.5" /> {hi ? "जोड़ें" : "Add"}
                </button>
              ) : null}
            </div>
            {geo === "ok" && ctx.location && !farmHasLocation && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-[var(--crop-green-100)] p-3 text-sm text-[var(--crop-green-900)]">
                <input
                  type="checkbox"
                  checked={value.saveFarmLocation}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onChange((prev) => ({ ...prev, saveFarmLocation: checked }));
                  }}
                  className="mt-0.5 size-4 accent-[var(--crop-green-600)]"
                />
                {hi
                  ? "इसे मेरे खेत की जगह के रूप में सेव करें (हर जांच में मौसम दिखेगा)"
                  : "Save as my farm location (weather on every check)"}
              </label>
            )}
            {geo === "denied" && (
              <p className="text-xs text-muted-foreground">
                {hi
                  ? "ब्राउज़र में ताले के निशान से अनुमति दें, या छोड़ दें — जांच फिर भी होगी।"
                  : "Allow it from the lock icon in the address bar, or leave it — the check still works."}
              </p>
            )}
          </div>
        </aside>

        {/* Farmer answers */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          <p className="text-sm text-muted-foreground">
            {hi
              ? "जो पता हो वही चुनें — सब वैकल्पिक है। इससे AI रिपोर्ट और मित्र आपकी फसल को बेहतर समझेंगे।"
              : "Pick only what you know — everything is optional. It helps the report and Mitra understand your field."}
          </p>
          <div className="grid gap-4 xl:grid-cols-2">
            {QUESTIONS.map((key, index) => (
              <fieldset
                key={key}
                className="flex flex-col gap-3 rounded-[24px] bg-white p-5 ring-1 ring-border"
              >
                <legend className="sr-only">{FIELD_LABELS[key][ui]}</legend>
                <p className="flex items-baseline gap-2.5">
                  <span className="text-[11px] font-semibold tracking-[0.16em] text-[var(--crop-green-600)] tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-semibold tracking-tight">
                    {FIELD_LABELS[key][ui]}
                  </span>
                  {key === "parts" && (
                    <span className="text-xs text-muted-foreground">
                      {hi ? "(एक से ज़्यादा)" : "(any)"}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(FIELD_OPTIONS[key]).map(
                    ([option, labels]) => {
                      const OptionIcon = ICONS[key][option];
                      const on = isOn(key, option);
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(key, option)}
                          className={cn(
                            "inline-flex h-11 items-center gap-2 rounded-2xl px-3.5 text-sm font-medium ring-1 transition-colors",
                            on
                              ? "bg-[var(--crop-green-800)] text-white ring-[var(--crop-green-800)]"
                              : "bg-[var(--crop-cream)] ring-border hover:bg-[var(--crop-green-100)]",
                          )}
                        >
                          <OptionIcon className="size-4" strokeWidth={1.8} />
                          {(labels as { en: string; hi: string })[ui]}
                        </button>
                      );
                    },
                  )}
                </div>
              </fieldset>
            ))}
          </div>
          <label className="flex flex-col gap-2 rounded-[24px] bg-white p-5 ring-1 ring-border">
            <span className="flex items-center gap-2 font-semibold tracking-tight">
              <NotebookPen className="size-4 text-[var(--crop-green-600)]" />{" "}
              {FIELD_LABELS.note[ui]}
            </span>
            <textarea
              value={ctx.note ?? ""}
              onChange={(e) =>
                set({ note: e.target.value.slice(0, 240) || undefined })
              }
              rows={2}
              maxLength={240}
              placeholder={
                hi
                  ? "जैसे: पिछले हफ़्ते बहुत बारिश हुई, निचले हिस्से में ज़्यादा असर"
                  : "e.g. heavy rain last week, worse in the low part of the field"
              }
              className="w-full resize-none rounded-2xl bg-[var(--crop-cream)] px-4 py-3 text-base ring-1 ring-border outline-none focus:ring-2 focus:ring-[var(--crop-green-500)]"
            />
          </label>

          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 rounded-[24px] bg-white/95 p-3 pl-5 ring-1 ring-border backdrop-blur-xl lg:bottom-4">
            <span className="text-sm text-muted-foreground">
              {answered
                ? hi
                  ? `${answered} जानकारी जोड़ी गई`
                  : `${answered} ${answered === 1 ? "detail" : "details"} added`
                : hi
                  ? "कोई जवाब नहीं — ठीक है"
                  : "No answers — that's fine"}
            </span>
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[var(--crop-green-800)] px-5 font-semibold text-white transition-colors hover:bg-[var(--crop-green-900)]"
            >
              {hi ? "आगे" : "Continue"} <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
