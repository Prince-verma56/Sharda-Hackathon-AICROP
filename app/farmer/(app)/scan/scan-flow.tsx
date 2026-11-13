"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FlaskConical,
  ImageIcon,
  Loader2,
  RotateCcw,
  Search,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import { displayClass, eyebrowClass } from "@/components/app/page-intro";
import { CropThumb } from "@/components/crops/crop-thumb";
import {
  answeredCount,
  deviceTimestamp,
  FIELD_OPTIONS,
} from "@/lib/cropai/field-context";
import { FieldDetailsStep, type FieldDetailsValue } from "./field-details-step";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cropName } from "@/lib/crops";
import { t } from "@/lib/i18n/farmer";
import { cn } from "@/lib/utils";
import { speakText } from "@/lib/voice/speak";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

interface Quality {
  ok: boolean;
  issues: ("dark" | "blurry" | "small")[];
}

/** Lightweight on-device heuristic (brightness + Laplacian variance). Not a trained classifier. */
async function checkQuality(file: File): Promise<Quality | "unreadable"> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = 320 / Math.max(bitmap.width, bitmap.height);
    const w = Math.max(1, Math.round(bitmap.width * Math.min(1, scale)));
    const h = Math.max(1, Math.round(bitmap.height * Math.min(1, scale)));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const gray = new Float32Array(w * h);
    let sum = 0;
    for (let i = 0; i < w * h; i++) {
      gray[i] =
        0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      sum += gray[i];
    }
    const mean = sum / (w * h);
    let lapSum = 0;
    let lapSq = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap =
          gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
        lapSum += lap;
        lapSq += lap * lap;
        n++;
      }
    }
    const variance = n ? lapSq / n - (lapSum / n) ** 2 : 0;
    const issues: Quality["issues"] = [];
    if (mean < 40) issues.push("dark");
    if (variance < 20) issues.push("blurry");
    if (Math.min(bitmap.width, bitmap.height) < 224) issues.push("small");
    bitmap.close();
    return { ok: issues.length === 0, issues };
  } catch {
    return "unreadable";
  }
}

function speak(text: string) {
  void speakText(text);
}

export interface ScanSample {
  file: string;
  crop: string;
  condition: string;
  url: string;
}

export function ScanFlow({
  crops,
  mainCrops,
  lang,
  hasConsent,
  initialCrop,
  samples = [],
  cropImages = {},
  farmHasLocation = false,
}: {
  crops: string[];
  mainCrops: string[];
  lang: string;
  hasConsent: boolean;
  initialCrop: string | null;
  samples?: ScanSample[];
  cropImages?: Record<string, string>;
  /** the farmer already has a farm location (no need to offer saving the device location) */
  farmHasLocation?: boolean;
}) {
  const router = useRouter();
  const tx = t(lang);
  const hi = lang !== "en";
  const [crop, setCrop] = useState<string | null>(
    initialCrop && crops.includes(initialCrop) ? initialCrop : null,
  );
  const [query, setQuery] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [consent, setConsent] = useState(hasConsent);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "analysing">(
    "idle",
  );
  const [progress, setProgress] = useState(0);
  const [details, setDetails] = useState<FieldDetailsValue>({
    context: {},
    saveFarmLocation: true,
  });
  const [detailsDone, setDetailsDone] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const step = !crop ? 1 : !file ? 2 : !detailsDone ? 3 : 4;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return crops.filter(
      (id) =>
        !q ||
        id.includes(q) ||
        cropName(id, "en").toLowerCase().includes(q) ||
        cropName(id, "hi").includes(q),
    );
  }, [crops, query]);
  const mine = mainCrops.filter((c) => crops.includes(c));

  async function onFile(next: File | undefined) {
    setError(null);
    if (!next) return;
    if (next.type && !TYPES.includes(next.type)) return setError(tx.badFile);
    if (next.size > MAX_BYTES) return setError(tx.tooLarge);
    const q = await checkQuality(next);
    if (q === "unreadable") return setError(tx.badFile);
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setQuality(q);
  }

  /** Uses a sample leaf photo as if it was taken now (switches to the sample's crop). */
  async function pickSample(sample: ScanSample) {
    setError(null);
    try {
      const blob = await (await fetch(sample.url)).blob();
      if (sample.crop !== crop) setCrop(sample.crop);
      await onFile(
        new File([blob], sample.file, { type: blob.type || "image/jpeg" }),
      );
    } catch {
      setError(tx.badFile);
    }
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setQuality(null);
    setError(null);
  }

  function upload() {
    if (!file || !crop) return;
    if (!consent) return setError(tx.consent);
    setError(null);
    setPhase("uploading");
    setProgress(0);
    const form = new FormData();
    form.set("image", file, file.name || "leaf.jpg");
    form.set("crop", crop);
    form.set("consent", String(consent));
    // optional field details (automatic date/time + location if allowed + the farmer's answers)
    form.set(
      "context",
      JSON.stringify({
        ...details.context,
        ...deviceTimestamp(),
        saveFarmLocation: details.saveFarmLocation,
      }),
    );
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/v1/farmer/diagnoses");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => setPhase("analysing");
    xhr.onerror = () => {
      setPhase("idle");
      setError(
        hi
          ? "इंटरनेट कनेक्शन जांचें और दोबारा कोशिश करें।"
          : "Check your internet and try again.",
      );
    };
    xhr.onload = () => {
      let body: {
        success: boolean;
        data?: { id: string };
        error?: { message: string };
      } = { success: false };
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (body.success && body.data) {
        router.push(`/farmer/diagnosis/${body.data.id}`);
        return;
      }
      setPhase("idle");
      setError(
        body.error?.message ??
          (hi
            ? "जांच नहीं हो पाई। दोबारा कोशिश करें।"
            : "The check failed. Please try again."),
      );
    };
    xhr.send(form);
  }

  return (
    <div className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col px-4 pt-6 pb-8 sm:px-6 lg:px-8 lg:pt-10">
      <div className="flex items-center gap-3">
        {step > 1 && phase === "idle" && (
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-2xl bg-white"
            aria-label={tx.back}
            onClick={() =>
              step === 4
                ? setDetailsDone(false)
                : step === 3
                  ? reset()
                  : setCrop(null)
            }
          >
            <ArrowLeft />
          </Button>
        )}
        <div className="flex-1">
          <p className={cn(eyebrowClass(lang), "text-[var(--crop-green-600)]")}>
            {tx.step(step, 4)}
          </p>
          <div className="mt-1.5 flex gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <span
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  s <= step ? "bg-[var(--crop-green-600)]" : "bg-border",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {step === 1 && (
        <section className="mt-6 flex flex-col gap-4">
          <h1
            className={cn("text-[clamp(2rem,5vw,3.4rem)]", displayClass(lang))}
          >
            {tx.chooseCrop}
          </h1>
          <label className="flex h-13 items-center gap-2 rounded-2xl bg-white px-4 ring-1 ring-border focus-within:ring-2 focus-within:ring-[var(--crop-green-500)] lg:max-w-xl">
            <Search className="size-5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx.searchCrop}
              className="h-12 flex-1 bg-transparent text-base outline-none"
            />
          </label>
          {mine.length > 0 && !query && (
            <>
              <h2 className={cn(eyebrowClass(lang), "text-muted-foreground")}>
                {tx.yourCrops}
              </h2>
              <CropGrid
                ids={mine}
                lang={lang}
                images={cropImages}
                onPick={setCrop}
              />
              <h2 className={cn(eyebrowClass(lang), "text-muted-foreground")}>
                {tx.allCrops}
              </h2>
            </>
          )}
          <CropGrid
            ids={filtered}
            lang={lang}
            images={cropImages}
            onPick={setCrop}
          />
          {Object.keys(cropImages).length > 0 && (
            <a
              href="/images/crops/CREDITS.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              {lang === "hi"
                ? "फसल फ़ोटो: विकिमीडिया कॉमन्स योगदानकर्ता (CC BY / CC BY-SA / CC0) — श्रेय"
                : "Crop photos: Wikimedia Commons contributors (CC BY / CC BY-SA / CC0) — credits"}
            </a>
          )}
        </section>
      )}

      {step === 2 && crop && (
        <section className="mt-6 flex flex-col gap-5 lg:gap-6">
          <div className="flex flex-col gap-2">
            <CropBadge id={crop} lang={lang} images={cropImages} />
            <h1
              className={cn(
                "text-[clamp(2rem,5vw,3.4rem)]",
                displayClass(lang),
              )}
            >
              {tx.takePhoto}
            </h1>
          </div>
          <div className="grid items-stretch gap-5 lg:grid-cols-12 lg:gap-6">
            <div className="flex flex-col lg:col-span-5">
              <div className="flex flex-1 flex-col rounded-[24px] bg-white p-5 ring-1 ring-border sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{tx.photoTips}</h2>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    onClick={() =>
                      speak(tx.tips.join(lang === "hi" ? "। " : ". "))
                    }
                  >
                    <Volume2 /> {tx.listenTips}
                  </Button>
                </div>
                <ol className="mt-3 grid gap-2 text-base">
                  {tx.tips.map((tip, i) => (
                    <li key={tip} className="flex items-center gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--crop-green-100)] text-sm font-bold text-[var(--crop-green-800)]">
                        {i + 1}
                      </span>
                      {tip}
                    </li>
                  ))}
                </ol>
                <div className="relative mt-5 hidden min-h-40 flex-1 overflow-hidden rounded-2xl sm:block">
                  <Image
                    src="/images/home/leaf.jpg"
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 30vw, 60vw"
                    className="object-cover"
                  />
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-[var(--crop-green-900)]">
                    {lang === "hi"
                      ? "ऐसी पास की, साफ़ फोटो"
                      : "Close, sharp and well lit — like this"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 lg:col-span-7">
              <Button
                className="h-20 rounded-[24px] text-xl"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="size-7" /> {tx.takePhoto}
              </Button>
              <Button
                variant="outline"
                className="h-14 rounded-[20px] bg-white text-base"
                onClick={() => galleryRef.current?.click()}
              >
                <ImageIcon /> {tx.gallery}
              </Button>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <input
                ref={galleryRef}
                type="file"
                accept={TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {samples.length > 0 && (
                <div className="rounded-[24px] bg-white p-4 ring-1 ring-border">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <FlaskConical className="size-4 text-[var(--crop-green-600)]" />{" "}
                    {lang === "hi"
                      ? "पत्ती पास नहीं है? नमूना फोटो से आज़माएँ"
                      : "No leaf handy? Try a sample photo"}
                  </p>
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
                    {[...samples]
                      .sort(
                        (a, b) =>
                          Number(b.crop === crop) - Number(a.crop === crop),
                      )
                      .map((sample) => (
                        <button
                          key={sample.file}
                          type="button"
                          onClick={() => void pickSample(sample)}
                          className="group flex flex-col gap-1 text-left"
                          title={`${cropName(sample.crop, lang)} · ${sample.condition}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated sample route */}
                          <img
                            src={sample.url}
                            alt=""
                            className="aspect-square w-full rounded-xl object-cover ring-1 ring-border transition group-hover:ring-2 group-hover:ring-[var(--crop-green-500)]"
                          />
                          <span className="truncate text-[11px] font-medium">
                            {cropName(sample.crop, lang)}
                          </span>
                        </button>
                      ))}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    PlantDoc (Singh et al., 2020) · CC BY 4.0
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {step === 3 && crop && (
        <FieldDetailsStep
          lang={lang}
          value={details}
          onChange={setDetails}
          onSkip={() => setDetailsDone(true)}
          onContinue={() => setDetailsDone(true)}
          farmHasLocation={farmHasLocation}
          preview={preview}
          header={
            <div className="flex flex-col gap-2">
              <CropBadge id={crop} lang={lang} images={cropImages} />
              <h1
                className={cn(
                  "text-[clamp(2rem,5vw,3.4rem)]",
                  displayClass(lang),
                )}
              >
                {lang === "hi" ? "खेत की जानकारी" : "Field details"}
              </h1>
            </div>
          }
        />
      )}

      {step === 4 && crop && preview && (
        <section className="mt-6 flex flex-col gap-5 lg:gap-6">
          <div className="flex flex-col gap-2">
            <CropBadge id={crop} lang={lang} images={cropImages} />
            <h1
              className={cn(
                "text-[clamp(2rem,5vw,3.4rem)]",
                displayClass(lang),
              )}
            >
              {lang === "hi" ? "फोटो जांचें" : "Check photo"}
            </h1>
          </div>
          <div className="grid items-stretch gap-5 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-7">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img
                src={preview}
                alt=""
                className="aspect-[4/3] w-full rounded-[28px] bg-black/5 object-cover lg:aspect-auto lg:h-full lg:max-h-[34rem]"
              />
            </div>
            <div className="flex flex-col gap-4 rounded-[28px] bg-white p-5 ring-1 ring-border sm:p-6 lg:col-span-5">
              {quality && (
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-2xl px-4 py-3 text-base",
                    quality.ok
                      ? "bg-[var(--crop-green-100)] text-[var(--crop-green-900)]"
                      : "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
                  )}
                >
                  {quality.ok ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                  ) : (
                    <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                  )}
                  <span>
                    {quality.ok
                      ? tx.qualityOk
                      : quality.issues
                          .map((i) =>
                            i === "dark"
                              ? tx.tooDark
                              : i === "blurry"
                                ? tx.tooBlurry
                                : tx.tooSmall,
                          )
                          .join(" ")}
                    <span className="block text-xs opacity-70">
                      {tx.qualityNote}
                    </span>
                  </span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--crop-cream)] px-3 py-2.5 text-xs ring-1 ring-border">
                <span className="font-semibold text-muted-foreground">
                  {lang === "hi" ? "खेत की जानकारी:" : "Field details:"}
                </span>
                {answeredCount(details.context) || details.context.location ? (
                  <>
                    {(
                      [
                        "cropStage",
                        "firstNoticed",
                        "spread",
                        "recentWeather",
                        "sprayed",
                      ] as const
                    ).map((key) => {
                      const v = details.context[key];
                      return v ? (
                        <span
                          key={key}
                          className="rounded-full bg-white px-2.5 py-1 ring-1 ring-border"
                        >
                          {
                            (
                              FIELD_OPTIONS[key] as Record<
                                string,
                                { en: string; hi: string }
                              >
                            )[v][hi ? "hi" : "en"]
                          }
                        </span>
                      ) : null;
                    })}
                    {details.context.location && (
                      <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-border">
                        {lang === "hi" ? "जगह ✓" : "Location ✓"}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {lang === "hi" ? "नहीं जोड़ी" : "none added"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setDetailsDone(false)}
                  className="ml-auto font-semibold text-[var(--crop-green-800)] hover:underline"
                >
                  {lang === "hi" ? "बदलें" : "Edit"}
                </button>
              </div>
              {!hasConsent && (
                <label className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-border">
                  <Checkbox
                    checked={consent}
                    onCheckedChange={(v) => setConsent(Boolean(v))}
                    className="mt-0.5 size-5"
                  />
                  {tx.consent}
                </label>
              )}
              {phase !== "idle" ? (
                <div
                  className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-border"
                  aria-live="polite"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Loader2 className="size-5 animate-spin" />
                    {phase === "uploading" ? tx.uploading : tx.analysing}
                  </span>
                  <Progress value={phase === "uploading" ? progress : 100} />
                </div>
              ) : (
                <div className="grid grid-cols-[auto_1fr] gap-3">
                  <Button
                    variant="outline"
                    className="h-16 rounded-[20px] bg-white px-5 text-base"
                    onClick={reset}
                  >
                    <RotateCcw /> {tx.retake}
                  </Button>
                  <Button
                    className="h-16 rounded-[20px] text-lg"
                    onClick={upload}
                    disabled={!consent}
                  >
                    {tx.usePhoto}
                  </Button>
                </div>
              )}
              <div className="mt-auto border-t border-border/70 pt-4">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--crop-green-600)] uppercase">
                  {lang === "hi" ? "आगे क्या होगा" : "What happens next"}
                </p>
                <ol className="mt-3 flex flex-col gap-2.5 text-sm text-muted-foreground">
                  {(lang === "hi"
                    ? [
                        "AI मॉडल फोटो जांचता है (कुछ सेकंड)",
                        "रिपोर्ट: संभावित स्थिति, स्कोर और आगे के कदम",
                        "मित्र समझाता है; ज़रूरत हो तो विशेषज्ञ से पूछें",
                      ]
                    : [
                        "The AI model checks the photo (a few seconds)",
                        "Your report: likely condition, score and next steps",
                        "Mitra explains it; ask an expert if needed",
                      ]
                  ).map((line, i) => (
                    <li key={line} className="flex items-center gap-3">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--crop-green-100)] text-xs font-bold text-[var(--crop-green-800)]">
                        {i + 1}
                      </span>
                      {line}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>
      )}

      {error && (
        <Alert variant="destructive" className="mt-4" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function CropBadge({
  id,
  lang,
  images,
}: {
  id: string;
  lang: string;
  images: Record<string, string>;
}) {
  return (
    <p className="flex items-center gap-2 text-base font-medium text-muted-foreground">
      <CropThumb id={id} images={images} size="sm" /> {cropName(id, lang)}
    </p>
  );
}

function CropGrid({
  ids,
  lang,
  images,
  onPick,
}: {
  ids: string[];
  lang: string;
  images: Record<string, string>;
  onPick: (id: string) => void;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-3 xl:grid-cols-8">
      {ids.map((id) => (
        <li key={id}>
          <button
            type="button"
            onClick={() => onPick(id)}
            className="flex min-h-28 w-full flex-col items-center justify-center gap-1.5 rounded-2xl bg-white px-1.5 py-3 ring-1 ring-border transition hover:ring-[var(--crop-green-500)] active:scale-95 active:bg-[var(--crop-green-100)]"
          >
            <CropThumb id={id} images={images} size="lg" />
            <span className="text-center text-sm leading-tight font-semibold">
              {cropName(id, lang)}
            </span>
            {lang !== "en" && (
              <span className="text-center text-[10px] leading-tight text-muted-foreground">
                {cropName(id, "en")}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
