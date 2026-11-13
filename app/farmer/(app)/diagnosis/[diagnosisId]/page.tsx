import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Bug,
  CalendarClock,
  Camera,
  Clock,
  CloudSun,
  Cpu,
  Droplets,
  Eye,
  FlaskConical,
  Gauge,
  ImageOff,
  Leaf,
  ShieldCheck,
  Thermometer,
  TriangleAlert,
  UserRoundCheck,
} from "lucide-react";
import { buildDeterministicExplanation } from "@/ai/genai/explain";
import { getMitraSettings } from "@/ai/settings/mitra-settings";
import { eyebrowClass } from "@/components/app/page-intro";
import { CropThumb } from "@/components/crops/crop-thumb";
import { LeafMark } from "@/components/marketing/home/brand";
import { cropName, splitLabel } from "@/lib/crops";
import { cn } from "@/lib/utils";
import { requireFarmer } from "@/server/auth/dal";
import { getCropImages } from "@/server/cropai/crop-images";
import { getDiagnosisForFarmer } from "@/server/cropai/diagnosis-service";
import { getApprovedGuidance } from "@/server/cropai/knowledge";
import { db } from "@/server/db";
import { ForecastChart, ReportActions, ScoreChart, ScoreGauge } from "./report-client";

export const metadata = { title: "Crop report" };

type Action = { kind: "inspect" | "prevent" | "expert" | "test"; text: string };
interface ExplanationJson {
  language?: "hi" | "en";
  summary: string;
  condition_explanation: string;
  possible_causes: string[];
  recommended_actions: Action[];
  sources: { title: string; url: string | null }[];
}

const ADVISORY: Record<string, { hi: string; en: string }> = {
  CROP_MISMATCH: { hi: "फोटो चुनी गई फसल से अलग लगती है", en: "Photo looks like a different crop" },
  WEAK_CROP_UPSTREAM: { hi: "इस फसल पर मॉडल कम सटीक रहा है", en: "Model is less accurate for this crop" },
  WEAK_CLASS_UPSTREAM: { hi: "इस बीमारी पर मॉडल कम भरोसेमंद", en: "Model is less reliable for this condition" },
  IMAGE_QUALITY: { hi: "फोटो साफ़ नहीं — दोबारा लें", en: "Low photo quality — retake" },
  LOW_GLOBAL_EVIDENCE: { hi: "पत्ती साफ़ नहीं दिख रही", en: "Leaf not clearly visible" },
};

const KIND = {
  inspect: { hi: "जांच करें", en: "Inspect", icon: Eye, tone: "bg-[var(--crop-green-100)] text-[var(--crop-green-800)]" },
  prevent: { hi: "बचाव", en: "Prevent", icon: ShieldCheck, tone: "bg-[var(--crop-green-800)] text-white" },
  expert: { hi: "विशेषज्ञ", en: "Expert", icon: UserRoundCheck, tone: "bg-amber-100 text-amber-900" },
  test: { hi: "और जांच", en: "Test", icon: FlaskConical, tone: "bg-sky-100 text-sky-900" },
} as const;

const card = "rounded-[28px] bg-white ring-1 ring-border";

export default async function DiagnosisReport({ params }: { params: Promise<{ diagnosisId: string }> }) {
  const farmer = await requireFarmer();
  const { diagnosisId } = await params;
  const d = await getDiagnosisForFarmer(diagnosisId, farmer.userId);
  if (!d) notFound();
  const lang = farmer.language === "en" ? "en" : "hi";
  const hi = lang === "hi";
  const [guidance, healthyRef, history, cropImages, mitra] = await Promise.all([
    getApprovedGuidance(d.predictedLabel),
    d.isHealthy ? null : getApprovedGuidance(`${d.predictedCrop}::Healthy`),
    db.diagnosis.findMany({
      where: { farmerId: farmer.userId, predictedCrop: d.predictedCrop },
      orderBy: { createdAt: "asc" },
      take: 24,
      select: { id: true, createdAt: true, predictedCondition: true, confidence: true, isHealthy: true },
    }),
    getCropImages(),
    getMitraSettings(farmer.userId),
  ]);

  // The page follows the language toggle: if the stored explanation is in the other language, the
  // grounded template explanation (same approved guidance) is rebuilt in the current language.
  const stored = d.explanation as unknown as ExplanationJson | null;
  const ex: ExplanationJson | null =
    stored && (stored.language ?? lang) === lang
      ? stored
      : buildDeterministicExplanation({
          language: lang,
          crop: d.predictedCrop,
          cropDisplay: cropName(d.predictedCrop, lang),
          predictedLabel: d.predictedLabel,
          predictedCondition: d.predictedCondition,
          isHealthy: d.isHealthy,
          modelVersion: d.modelVersion,
          score: d.confidence,
          topPredictions: d.predictions.map((p) => ({ label: p.label, score: p.score })),
          advisories: ((d.advisories as { code: string }[]) ?? []).map((a) => a.code),
          guidance: guidance
            ? {
                title: guidance.title,
                summary: guidance.summary,
                symptoms: guidance.symptoms,
                causes: guidance.causes,
                inspectionSteps: guidance.inspectionSteps,
                prevention: guidance.prevention,
                approvedTreatment: guidance.approvedTreatment,
                furtherTesting: guidance.furtherTesting,
                sourceUrl: guidance.sourceUrl,
                sourceOrganisation: guidance.sourceOrganisation,
              }
            : null,
          weather: null,
          farmerName: null,
        }).explanation;

  const advisories = (d.advisories as { code: string }[]) ?? [];
  const score = Math.round(d.confidence * 100);
  const weather = d.weather;
  const forecast =
    (weather?.forecast as { forecast?: { date: string; maxC: number | null; minC: number | null; rainMm: number | null }[] } | null)?.forecast ?? [];
  const review = d.reviews[0];
  const actions = ex?.recommended_actions ?? [];
  const symptoms = d.knowledge?.symptoms ?? [];
  const causes = ex?.possible_causes ?? [];
  const when = d.createdAt.toLocaleString(hi ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" });
  const reviewLabel = review
    ? review.verdict === "CONFIRMED"
      ? hi
        ? "पुष्टि हुई"
        : "Confirmed"
      : review.verdict === "CHALLENGED"
        ? hi
          ? "अलग राय"
          : "Different opinion"
        : hi
          ? "और जानकारी चाहिए"
          : "More info needed"
    : d.reviewStatus === "PENDING"
      ? hi
        ? "जांच बाकी"
        : "Pending"
      : hi
        ? "नहीं भेजी"
        : "Not requested";

  // "Listen" follows the farmer's Mitra language (Hinglish by default). Hindi words are written in
  // Devanagari so a Hindi voice pronounces them; crop/condition names stay in English.
  const speakIn = mitra.effective.language;
  const cropEn = cropName(d.predictedCrop, "en");
  const steps = actions.map((a, i) => `${i + 1}. ${a.text}`).join(" ");
  const count = (kind: Action["kind"]) => actions.filter((a) => a.kind === kind).length;
  // Guidance steps are stored in English, so the Hindi/Hinglish script summarises them instead of
  // switching language mid-way; the full steps are on screen.
  const stepsHinglish = actions.length
    ? `आगे के ${actions.length} कदम screen पर हैं — ${[count("inspect") && `${count("inspect")} जांच के`, count("prevent") && `${count("prevent")} बचाव के`, count("test") && `${count("test")} और testing के`].filter(Boolean).join(", ")}${count("expert") ? ", और expert से सलाह" : ""}।`
    : "";
  const stepsHindi = actions.length
    ? `आगे के ${actions.length} कदम स्क्रीन पर हैं — ${[count("inspect") && `${count("inspect")} जांच के`, count("prevent") && `${count("prevent")} बचाव के`, count("test") && `${count("test")} और जांच के`].filter(Boolean).join(", ")}${count("expert") ? ", और विशेषज्ञ से सलाह" : ""}।`
    : "";
  const speech =
    speakIn === "en"
      ? [ex?.summary, ...actions.map((a, i) => `${i + 1}. ${a.text}`)].filter(Boolean).join(" ")
      : speakIn === "hi"
        ? [
            `आपकी ${cropName(d.predictedCrop, "hi")} की फोटो में AI मॉडल को ${d.predictedCondition} जैसे संकेत मिले हैं, मॉडल स्कोर ${score} प्रतिशत।`,
            d.isHealthy ? "पौधा स्वस्थ जैसा दिख रहा है।" : "यह स्क्रीनिंग है, पक्की पुष्टि नहीं।",
            stepsHindi,
            "ज़्यादा जानकारी के लिए मित्र से पूछिए, या विशेषज्ञ से पुष्टि कराइए।",
          ]
            .filter(Boolean)
            .join(" ")
        : [
            `आपके ${cropEn} की photo में AI model को ${d.predictedCondition} जैसे संकेत दिखे हैं, model score ${score} percent।`,
            d.isHealthy ? "पौधा healthy दिख रहा है।" : "यह एक screening है, पक्की diagnosis नहीं।",
            stepsHinglish,
            "और जानकारी के लिए Mitra से बात कीजिए — Ask Mitra दबाइए।",
          ]
            .filter(Boolean)
            .join(" ");
  const speechFallback = [
    `Aapke ${cropEn} ki photo mein AI model ko ${d.predictedCondition} jaise sanket dikhe hain, model score ${score} percent.`,
    d.isHealthy ? "Paudha healthy dikh raha hai." : "Yeh ek screening hai, pakki diagnosis nahi.",
    actions.length ? `Aage ke ${actions.length} kadam screen par hain.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const shareText = `${cropName(d.predictedCrop, lang)}: ${d.predictedCondition} (${hi ? "मॉडल स्कोर" : "model score"} ${score}%) — ${when}. ${hi ? "AI जांच, लैब पुष्टि नहीं।" : "AI screening, not lab-confirmed."}`;
  const source = ex?.sources?.find((s) => s.url);
  const title = (text: string) => <h2 className="text-xl font-semibold tracking-tight">{text}</h2>;
  const eyebrow = (text: string) => <p className={cn(eyebrowClass(lang), "text-[var(--crop-green-600)]")}>{text}</p>;
  const tiny = cn("text-[10px] font-semibold text-muted-foreground", !hi && "tracking-[0.14em] uppercase");

  return (
    <article className="mx-auto flex w-full max-w-[88rem] flex-col gap-5 px-4 pt-5 pb-10 sm:px-6 lg:gap-6 lg:px-8 lg:pt-8 print:px-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/farmer/history" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {hi ? "सभी रिपोर्ट" : "All reports"}
        </Link>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" /> {when}
        </span>
      </div>

      {/* Row 1 — the photo + the result at a glance */}
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <header className="relative min-h-[24rem] overflow-hidden rounded-[28px] bg-[var(--crop-green-950)] text-white lg:col-span-7 lg:min-h-[28rem]">
          {/* eslint-disable-next-line @next/next/no-img-element -- private authenticated image */}
          <img src={`/api/v1/images/diagnoses/${d.id}`} alt={hi ? "आपकी पत्ती की फोटो" : "Your leaf photo"} className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />
          <div className="relative flex h-full min-h-[inherit] flex-col justify-between gap-6 p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-semibold backdrop-blur-md">{hi ? "आपकी फोटो" : "Your photo"}</span>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md",
                  d.isHealthy ? "bg-[var(--crop-green-100)]/95 text-[var(--crop-green-900)]" : "bg-amber-50/95 text-amber-900",
                )}
              >
                {d.isHealthy ? (hi ? "स्वस्थ जैसा" : "Looks healthy") : hi ? "ध्यान दें" : "Needs attention"}
              </span>
            </div>
            <div>
              <span className="flex items-center gap-2 text-sm text-white/85">
                <CropThumb id={d.predictedCrop} images={cropImages} size="sm" className="rounded-full ring-2 ring-white/40" />
                {cropName(d.predictedCrop, lang)}
                {d.selectedCrop && d.selectedCrop !== d.predictedCrop ? ` · ${hi ? "चुनी गई" : "selected"}: ${cropName(d.selectedCrop, lang)}` : ""}
              </span>
              <h1 className={cn("mt-2 text-[clamp(2.2rem,5vw,3.8rem)] font-semibold", hi ? "leading-tight tracking-tight" : "leading-[0.92] tracking-[-0.045em] uppercase")}>
                {d.predictedCondition}
              </h1>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs backdrop-blur-md">
                <Cpu className="size-3.5" /> {hi ? "AI जांच — लैब पुष्टि नहीं" : "AI screening — not lab-confirmed"} · {d.modelVersion}
              </p>
            </div>
          </div>
        </header>

        <section className={cn(card, "flex flex-col gap-5 p-5 sm:p-6 lg:col-span-5")}>
          <div className="flex items-start justify-between gap-3">
            {eyebrow(hi ? "AI नतीजा" : "AI result")}
            <Gauge className="size-5 text-[var(--crop-green-600)]" />
          </div>
          <ScoreGauge score={score} healthy={d.isHealthy} label={hi ? "मॉडल स्कोर" : "Model score"} />
          {ex?.summary && <p className="text-center text-[15px] leading-relaxed text-muted-foreground">{ex.summary}</p>}
          <dl className="mt-auto grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-border/70 text-center">
            <Tile icon={Camera} label={hi ? "फोटो" : "Photo"} value={d.qualityStatus === "ok" ? (hi ? "ठीक" : "OK") : hi ? "कमज़ोर" : "Weak"} good={d.qualityStatus === "ok"} lang={lang} />
            <Tile icon={Bug} label={hi ? "गंभीरता" : "Severity"} value={hi ? "आकलन नहीं" : "Not rated"} lang={lang} />
            <Tile icon={BadgeCheck} label={hi ? "विशेषज्ञ" : "Expert"} value={reviewLabel} good={review?.verdict === "CONFIRMED"} lang={lang} />
          </dl>
          {advisories.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {advisories.map((a) => (
                <li key={a.code} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                  <TriangleAlert className="size-3.5" /> {ADVISORY[a.code]?.[lang] ?? a.code}
                </li>
              ))}
            </ul>
          )}
          {review && (
            <div className="rounded-2xl bg-[var(--crop-green-100)] px-4 py-3 text-sm text-[var(--crop-green-900)]">
              <p className="flex items-center gap-2 font-semibold">
                <BadgeCheck className="size-4" /> {hi ? "विशेषज्ञ की राय" : "Expert review"}: {reviewLabel}
              </p>
              {review.correctedLabel && (
                <p className="mt-1">
                  {hi ? "विशेषज्ञ के अनुसार" : "Expert says"}: {splitLabel(review.correctedLabel).condition}
                </p>
              )}
              {review.note && <p className="mt-1 opacity-85">{review.note}</p>}
            </div>
          )}
          {!review && d.reviewStatus === "PENDING" && (
            <p className="flex items-center gap-2 rounded-2xl bg-[var(--crop-cream)] px-4 py-3 text-sm ring-1 ring-border">
              <Clock className="size-4 shrink-0 text-[var(--crop-green-600)]" /> {hi ? "विशेषज्ञ इस रिपोर्ट की जांच करेंगे।" : "An expert will review this report."}
            </p>
          )}
        </section>
      </div>

      {/* Row 2 — actions */}
      <ReportActions id={d.id} lang={lang} speech={speech} speechFallback={speechFallback} shareText={shareText} reviewStatus={d.reviewStatus} feedback={d.feedback[0]?.helpful ?? null} />

      {/* Row 3 — what the model considered + Mitra */}
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <section className={cn(card, "flex flex-col gap-4 p-5 sm:p-6 lg:col-span-7")}>
          <div>
            {eyebrow(hi ? "मॉडल ने क्या देखा" : "What the model considered")}
            <div className="mt-1">{title(hi ? "शीर्ष अनुमान" : "Top predictions")}</div>
            <p className="mt-1 text-sm text-muted-foreground">{hi ? "गहरा बार = सबसे संभावित। स्कोर अनुमान है, पक्की पुष्टि नहीं।" : "Dark bar = most likely. Scores are estimates, not certainty."}</p>
          </div>
          <ScoreChart data={d.predictions.filter((p) => p.rank === 1 || p.score >= 0.01).slice(0, 5).map((p) => ({ name: splitLabel(p.label).condition, score: Math.round(p.score * 100), top: p.rank === 1 }))} />
        </section>

        <section className="relative overflow-hidden rounded-[28px] bg-[var(--crop-green-950)] text-white lg:col-span-5 print:hidden">
          <Image src="/images/home/field-band.jpg" alt="" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--crop-green-950)]/60 via-[var(--crop-green-950)]/85 to-[var(--crop-green-950)]" />
          <div className="relative flex h-full flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-semibold tracking-tight">
                <LeafMark className="size-5 text-[var(--crop-green-200)]" /> {hi ? "मित्र" : "MITRA"}
              </span>
              <span className={cn("rounded-full border border-white/30 px-3 py-1 font-semibold backdrop-blur-md", hi ? "text-[12px]" : "text-[10px] tracking-[0.16em] uppercase")}>
                {hi ? "AI सलाहकार" : "AI mentor"}
              </span>
            </div>
            <h2 className={cn("text-[1.7rem] font-semibold", hi ? "leading-tight tracking-tight" : "leading-[0.95] tracking-[-0.04em] uppercase")}>
              {hi ? (
                <>
                  इस <span className="text-[var(--crop-green-200)]">रिपोर्ट</span> पर पूछें
                </>
              ) : (
                <>
                  Ask about <span className="text-[var(--crop-green-200)]">this report</span>
                </>
              )}
            </h2>
            <div className="flex flex-col gap-2">
              {(hi
                ? ["इस नतीजे का क्या मतलब है?", "सबसे पहले मुझे क्या करना चाहिए?", "इसे फैलने से कैसे रोकूँ?", "दोबारा कब जांच करूँ?"]
                : ["What does this result mean?", "What should I do first?", "How do I stop it spreading?", "When should I check again?"]
              ).map((q) => (
                <Link
                  key={q}
                  href={`/farmer/assistant?diagnosis=${d.id}&q=${encodeURIComponent(q)}`}
                  className="group flex items-center justify-between gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-medium ring-1 ring-white/10 backdrop-blur-md transition-colors hover:bg-white/20"
                >
                  {q} <ArrowUpRight className="size-4 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Row 4 — what to do next (visual steps) */}
      {actions.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              {eyebrow(hi ? `${actions.length} कदम` : `${actions.length} steps`)}
              <div className="mt-1">{title(hi ? "आगे क्या करें" : "What to do next")}</div>
            </div>
            {source?.url && (
              <a href={source.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                {hi ? "स्रोत" : "Source"}: {source.title}
              </a>
            )}
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actions.map((a, i) => {
              const k = KIND[a.kind];
              return (
                <li key={`${a.kind}-${i}`} className={cn(card, "flex flex-col gap-3 p-4")}>
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("grid size-10 place-items-center rounded-xl", k.tone)}>
                      <k.icon className="size-5" strokeWidth={1.8} />
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={tiny}>{k[lang]}</span>
                      <span className="grid size-6 place-items-center rounded-full bg-[var(--crop-cream)] text-xs font-bold tabular-nums ring-1 ring-border">{i + 1}</span>
                    </span>
                  </span>
                  <span className="text-[15px] leading-snug">{a.text}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Row 5 — what to look for + weather */}
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <section className={cn(card, "flex flex-col gap-4 p-5 sm:p-6 lg:col-span-7")}>
          <div>
            {eyebrow(hi ? "पहचान" : "Recognise it")}
            <div className="mt-1">{title(hi ? "किन बातों पर ध्यान दें" : "What to look for")}</div>
          </div>
          {symptoms.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {symptoms.map((s) => (
                <li key={s} className="flex items-start gap-3 rounded-2xl bg-[var(--crop-cream)] p-3 text-sm ring-1 ring-border">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
                    <Leaf className="size-4" />
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <>
              {/* No approved symptom list yet: general field scouting (safe, condition-independent). */}
              <ul className="grid gap-2 sm:grid-cols-3">
                {(hi
                  ? [
                      { icon: Eye, text: "पत्तियों के दोनों तरफ़ देखें — ऊपर और नीचे" },
                      { icon: Leaf, text: "एक कतार के 10 पौधों में से कितने प्रभावित हैं, गिनें" },
                      { icon: CalendarClock, text: "2–3 दिन बाद दोबारा देखें — क्या धब्बे फैल रहे हैं?" },
                    ]
                  : [
                      { icon: Eye, text: "Look at both sides of the leaves — top and underside" },
                      { icon: Leaf, text: "Count how many of 10 plants in a row are affected" },
                      { icon: CalendarClock, text: "Look again in 2–3 days — are the spots spreading?" },
                    ]
                ).map(({ icon: Icon, text }) => (
                  <li key={text} className="flex flex-col gap-3 rounded-2xl bg-[var(--crop-cream)] p-4 text-sm ring-1 ring-border">
                    <span className="grid size-9 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
                      <Icon className="size-4" />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                {hi ? "इस स्थिति के लक्षणों की विशेषज्ञ-स्वीकृत सूची अभी नहीं है — ये सामान्य जांच के तरीके हैं।" : "No expert-approved symptom list for this condition yet — these are general scouting steps."}
              </p>
            </>
          )}
          {causes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={tiny}>{hi ? "संभावित कारण" : "Likely causes"}</span>
              {causes.map((c) => (
                <span key={c} className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-border">
                  {c}
                </span>
              ))}
            </div>
          )}
          {ex?.condition_explanation && (
            <details className="group mt-auto rounded-2xl bg-[var(--crop-cream)] px-4 py-3 text-sm ring-1 ring-border">
              <summary className="cursor-pointer list-none font-medium text-[var(--crop-green-800)]">
                {hi ? "इस बीमारी के बारे में पढ़ें" : "Read about this condition"} <span className="text-muted-foreground group-open:hidden">↓</span>
              </summary>
              <p className="mt-2 leading-relaxed text-muted-foreground">{ex.condition_explanation}</p>
            </details>
          )}
          {symptoms.length > 0 && (
            <p className="text-[11px] text-muted-foreground">{hi ? "ये लक्षण मॉडल ने अलग से नहीं पहचाने — अपनी फसल से मिलाकर देखें।" : "Symptoms are general information, not individually detected by the model."}</p>
          )}
        </section>

        <section className={cn(card, "flex flex-col gap-4 p-5 sm:p-6 lg:col-span-5")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              {eyebrow(hi ? "मौसम (संदर्भ)" : "Weather context")}
              <div className="mt-1">{title(hi ? "जांच के समय मौसम" : "Weather at the check")}</div>
            </div>
            <CloudSun className="size-5 text-[var(--crop-green-600)]" />
          </div>
          {weather ? (
            <>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border/70 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <WeatherTile icon={Thermometer} label={hi ? "तापमान" : "Temp"} value={`${weather.temperatureC ?? "—"}°`} lang={lang} />
                <WeatherTile icon={Droplets} label={hi ? "नमी" : "Humidity"} value={`${weather.humidityPct ?? "—"}%`} lang={lang} />
                <WeatherTile icon={CloudSun} label={hi ? "बारिश 24 घं." : "Rain 24 h"} value={`${weather.rainLast24hMm ?? "—"}`} unit="mm" lang={lang} />
                <WeatherTile icon={CloudSun} label={hi ? "बारिश 3 दिन" : "Rain 3 days"} value={`${weather.rainLast72hMm ?? "—"}`} unit="mm" lang={lang} />
              </dl>
              {forecast.length > 0 && (
                <div>
                  <p className={tiny}>{hi ? "आगे के दिन: बारिश (मिमी) और अधिकतम तापमान" : "Next days: rain (mm) and max temperature"}</p>
                  <ForecastChart
                    data={forecast.slice(0, 5).map((f) => ({
                      day: new Date(f.date).toLocaleDateString(hi ? "hi-IN" : "en-IN", { weekday: "short" }),
                      max: f.maxC,
                      min: f.minC,
                      rain: f.rainMm ?? 0,
                    }))}
                  />
                </div>
              )}
              <p className="mt-auto text-[11px] text-muted-foreground">
                {hi ? "केवल मौसम की जानकारी — बीमारी का खतरा नहीं बताती।" : "Context only — not a disease-risk prediction."} · Open-Meteo
              </p>
            </>
          ) : (
            <Link href="/farmer/profile" className="group flex flex-1 items-center gap-4 rounded-2xl bg-[var(--crop-cream)] p-4 ring-1 ring-border transition-colors hover:bg-[var(--crop-green-100)]">
              <CloudSun className="size-6 shrink-0 text-[var(--crop-green-600)]" />
              <span className="flex-1 text-sm">{hi ? "मौसम देखने के लिए प्रोफ़ाइल में खेत की जगह जोड़ें।" : "Add your farm location in your profile to see weather."}</span>
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </Link>
          )}
        </section>
      </div>

      {/* Row 6 — photo comparison + this crop's history */}
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <section className={cn(card, "flex flex-col gap-4 p-5 sm:p-6 lg:col-span-7")}>
          <div>
            {eyebrow(hi ? "तुलना" : "Compare")}
            <div className="mt-1">{title(hi ? "फोटो तुलना" : "Photo comparison")}</div>
            <p className="mt-1 text-sm text-muted-foreground">{hi ? "संदर्भ फोटो सिर्फ़ तुलना के लिए हैं।" : "Reference photos are for comparison only."}</p>
          </div>
          <div className={cn("grid grid-cols-2 gap-3", healthyRef && "sm:grid-cols-3")}>
            <figure className="flex flex-col gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/v1/images/diagnoses/${d.id}`} alt="" className="aspect-square rounded-2xl object-cover" />
              <figcaption className="text-xs font-medium">{hi ? "आपकी फोटो" : "Your photo"}</figcaption>
            </figure>
            {[{ entry: d.knowledge, label: d.predictedCondition }, ...(healthyRef ? [{ entry: healthyRef, label: hi ? "स्वस्थ पौधा" : "Healthy plant" }] : [])].map(({ entry, label }, i) =>
              entry?.referenceImageKey ? (
                <figure key={i} className="flex flex-col gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/v1/images/knowledge/${entry.id}`} alt="" className="aspect-square rounded-2xl object-cover" />
                  <figcaption className="text-xs font-medium">
                    {label}
                    {entry.referenceImageCredit ? <span className="text-muted-foreground"> · {entry.referenceImageCredit}</span> : null}
                  </figcaption>
                </figure>
              ) : (
                <div key={i} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--crop-cream)] p-3 text-center text-xs text-muted-foreground ring-1 ring-border">
                  <ImageOff className="size-6" /> {hi ? "सत्यापित संदर्भ फोटो अभी नहीं" : "No verified reference photo yet"}
                </div>
              ),
            )}
          </div>
        </section>

        <section className={cn(card, "flex flex-col gap-4 p-5 sm:p-6 lg:col-span-5")}>
          <div>
            {eyebrow(hi ? `${history.length} जांच` : `${history.length} ${history.length === 1 ? "check" : "checks"}`)}
            <div className="mt-1">{title(hi ? `${cropName(d.predictedCrop, lang)} की जांच` : `Your ${cropName(d.predictedCrop, lang)} checks`)}</div>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label={hi ? "जांच इतिहास" : "Check history"}>
            {history.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/farmer/diagnosis/${h.id}`}
                  title={`${h.createdAt.toLocaleDateString(hi ? "hi-IN" : "en-IN", { dateStyle: "medium" })} · ${h.predictedCondition} · ${Math.round(h.confidence * 100)}%`}
                  aria-label={`${h.createdAt.toLocaleDateString(hi ? "hi-IN" : "en-IN", { dateStyle: "medium" })} · ${h.predictedCondition}`}
                  className={cn(
                    "block size-9 rounded-lg ring-offset-2 transition-transform hover:scale-110",
                    h.isHealthy ? "bg-[var(--crop-green-500)]" : "bg-amber-500",
                    h.id === d.id && "ring-2 ring-[var(--crop-ink)]",
                  )}
                  style={{ opacity: 0.35 + h.confidence * 0.65 }}
                />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-[var(--crop-green-500)]" /> {hi ? "स्वस्थ जैसा" : "Looks healthy"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-amber-500" /> {hi ? "ध्यान दें" : "Needs attention"}
            </span>
            <span>{hi ? "गहरा रंग = ज़्यादा स्कोर · यह जांच = काली रेखा" : "Darker = higher score · this check = outlined"}</span>
          </div>
          {history.length <= 1 && (
            <p className="rounded-2xl bg-[var(--crop-cream)] p-4 text-sm text-muted-foreground ring-1 ring-border">
              {hi ? "यह इस फसल की पहली जांच है। अगली जांच के बाद बदलाव यहाँ दिखेंगे।" : "This is your first check for this crop. Changes appear here after your next check."}
            </p>
          )}
          <Link
            href={`/farmer/scan?crop=${d.predictedCrop}`}
            className="mt-auto inline-flex h-11 w-fit items-center gap-2 rounded-2xl bg-[var(--crop-green-800)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--crop-green-900)] print:hidden"
          >
            <Camera className="size-4" /> {hi ? "दोबारा जांचें" : "Check again"}
          </Link>
        </section>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        {hi ? "यह AI स्क्रीनिंग है, लैब जांच नहीं। कोई भी दवा इस्तेमाल करने से पहले कृषि विशेषज्ञ से सलाह लें।" : "This is an AI screening, not a lab test. Consult an agriculture expert before using any chemical."} · {d.modelName}{" "}
        {d.modelVersion}
      </p>
    </article>
  );
}

function Tile({ icon: Icon, label, value, good, lang }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; good?: boolean; lang: string }) {
  return (
    <div className="flex flex-col-reverse items-center gap-1 bg-[var(--crop-cream)] px-2 py-3">
      <dt className={cn("text-[9px] font-semibold text-muted-foreground", lang !== "hi" && "tracking-[0.14em] uppercase")}>{label}</dt>
      <dd className="flex flex-col items-center gap-1 text-sm font-semibold">
        <Icon className={cn("size-4", good ? "text-[var(--crop-green-600)]" : "text-muted-foreground")} />
        {value}
      </dd>
    </div>
  );
}

function WeatherTile({ icon: Icon, label, value, unit, lang }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; unit?: string; lang: string }) {
  return (
    <div className="flex flex-col-reverse gap-1 bg-[var(--crop-cream)] p-3">
      <dt className={cn("text-[9px] font-semibold text-muted-foreground", lang !== "hi" && "tracking-[0.14em] uppercase")}>{label}</dt>
      <dd className="flex flex-col gap-1">
        <Icon className="size-4 text-[var(--crop-green-600)]" />
        <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">
          {value}
          {unit && <span className="ml-0.5 text-xs font-medium text-muted-foreground">{unit}</span>}
        </span>
      </dd>
    </div>
  );
}
