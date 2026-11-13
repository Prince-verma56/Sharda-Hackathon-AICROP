import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  CloudSun,
  Cpu,
  Droplets,
  Eye,
  FlaskConical,
  ImageOff,
  Info,
  ShieldCheck,
  Sparkles,
  Sprout,
  Thermometer,
  TriangleAlert,
  UserRoundCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cropName, splitLabel } from "@/lib/crops";
import { requireFarmer } from "@/server/auth/dal";
import { getDiagnosisForFarmer } from "@/server/cropai/diagnosis-service";
import { getApprovedGuidance } from "@/server/cropai/knowledge";
import { db } from "@/server/db";
import { ReportActions, ScoreChart } from "./report-client";

export const metadata = { title: "Crop report" };

type Action = { kind: "inspect" | "prevent" | "expert" | "test"; text: string };
interface ExplanationJson {
  summary: string;
  condition_explanation: string;
  possible_causes: string[];
  recommended_actions: Action[];
  sources: { title: string; url: string | null }[];
}

const ADVISORY: Record<string, { hi: string; en: string }> = {
  CROP_MISMATCH: {
    hi: "फोटो चुनी गई फसल से अलग फसल जैसी लगती है। सही फसल चुनकर दोबारा जांचें।",
    en: "The photo looks like a different crop than the one selected. Check the crop and try again.",
  },
  WEAK_CROP_UPSTREAM: {
    hi: "इस फसल पर मॉडल की परीक्षण सटीकता कम रही है। विशेषज्ञ से पुष्टि ज़रूर कराएं।",
    en: "The model was less accurate for this crop in testing. Please confirm with an expert.",
  },
  WEAK_CLASS_UPSTREAM: {
    hi: "मॉडल इस बीमारी को पहचानने में परीक्षण में कम भरोसेमंद रहा है।",
    en: "The model was less reliable for this condition in testing.",
  },
  IMAGE_QUALITY: {
    hi: "फोटो साफ़ नहीं है। बेहतर रोशनी में दोबारा फोटो लें।",
    en: "The photo quality is low. Retake it in better light.",
  },
  LOW_GLOBAL_EVIDENCE: {
    hi: "फोटो में फसल की पत्ती साफ़ नहीं दिख रही। एक पत्ती की नज़दीकी फोटो लें।",
    en: "A crop leaf is not clearly visible. Take a close-up of one leaf.",
  },
};

const KIND = {
  inspect: { hi: "जांच करें", en: "Inspect", icon: Eye },
  prevent: { hi: "बचाव", en: "Prevent", icon: ShieldCheck },
  expert: { hi: "विशेषज्ञ", en: "Expert", icon: UserRoundCheck },
  test: { hi: "और जांच", en: "Further testing", icon: FlaskConical },
} as const;

export default async function DiagnosisReport({
  params,
}: {
  params: Promise<{ diagnosisId: string }>;
}) {
  const farmer = await requireFarmer();
  const { diagnosisId } = await params;
  const d = await getDiagnosisForFarmer(diagnosisId, farmer.userId);
  if (!d) notFound();
  const lang = farmer.language === "en" ? "en" : "hi";
  const hi = lang === "hi";
  const ex = d.explanation as unknown as ExplanationJson | null;
  const advisories = (d.advisories as { code: string }[]) ?? [];
  const score = Math.round(d.confidence * 100);
  const healthyRef = d.isHealthy
    ? null
    : await getApprovedGuidance(`${d.predictedCrop}::Healthy`);
  const history = await db.diagnosis.findMany({
    where: {
      farmerId: farmer.userId,
      predictedCrop: d.predictedCrop,
      id: { not: d.id },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      createdAt: true,
      predictedCondition: true,
      confidence: true,
      isHealthy: true,
    },
  });
  const weather = d.weather;
  const forecast =
    (
      weather?.forecast as {
        forecast?: {
          date: string;
          maxC: number | null;
          minC: number | null;
          rainMm: number | null;
        }[];
      } | null
    )?.forecast ?? [];
  const review = d.reviews[0];
  const actions = ex?.recommended_actions ?? [];
  const when = d.createdAt.toLocaleString(hi ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const speech = [
    ex?.summary,
    ex?.condition_explanation,
    ...actions.map((a, i) => `${i + 1}. ${a.text}`),
  ]
    .filter(Boolean)
    .join(" ");
  const shareText = `${cropName(d.predictedCrop, lang)}: ${d.predictedCondition} (${hi ? "मॉडल स्कोर" : "model score"} ${score}%) — ${when}. ${hi ? "AI जांच, लैब पुष्टि नहीं।" : "AI screening, not lab-confirmed."}`;

  return (
    <article className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-4 pb-8 lg:max-w-6xl lg:px-8 lg:pt-8 print:px-0">
      <Link
        href="/farmer/history"
        className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground print:hidden"
      >
        <ArrowLeft className="size-4" /> {hi ? "सभी रिपोर्ट" : "All reports"}
      </Link>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col gap-4 lg:col-span-7">
          {/* A. Header */}
          <header className="overflow-hidden rounded-[28px] bg-white ring-1 ring-border">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- private authenticated image */}
              <img
                src={`/api/v1/images/diagnoses/${d.id}`}
                alt={hi ? "आपकी पत्ती की फोटो" : "Your leaf photo"}
                className="aspect-[4/3] w-full object-cover"
              />
              <Badge className="absolute top-3 left-3 bg-black/60 text-white backdrop-blur">
                {hi ? "आपकी फोटो" : "Your photo"}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 p-5">
              <span className="text-sm text-muted-foreground">
                {cropName(d.predictedCrop, lang)}
                {d.selectedCrop && d.selectedCrop !== d.predictedCrop
                  ? ` (${hi ? "चुनी गई" : "selected"}: ${cropName(d.selectedCrop, lang)})`
                  : ""}
              </span>
              <h1 className="text-[1.9rem] leading-tight font-semibold tracking-tight">
                {d.predictedCondition}
              </h1>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant={d.isHealthy ? "secondary" : "destructive"}>
                  {d.isHealthy
                    ? hi
                      ? "स्वस्थ जैसा"
                      : "Looks healthy"
                    : hi
                      ? "ध्यान दें"
                      : "Needs attention"}
                </Badge>
                <Badge variant="outline">
                  <Cpu /> AI{" "}
                  {hi
                    ? "जांच — लैब पुष्टि नहीं"
                    : "screening — not lab-confirmed"}
                </Badge>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" /> {when} · {d.modelVersion}
              </p>
            </div>
          </header>

          {/* Expert review result (stored separately from the model output) */}
          {review && (
            <Card className="rounded-[24px] border-0 bg-[var(--crop-green-100)] px-5 py-4 ring-0">
              <p className="flex items-center gap-2 font-semibold text-[var(--crop-green-900)]">
                <BadgeCheck className="size-5" />{" "}
                {hi ? "विशेषज्ञ की राय" : "Expert review"}:{" "}
                {review.verdict === "CONFIRMED"
                  ? hi
                    ? "पुष्टि हुई"
                    : "Confirmed"
                  : review.verdict === "CHALLENGED"
                    ? hi
                      ? "अलग राय"
                      : "Different opinion"
                    : hi
                      ? "और जानकारी चाहिए"
                      : "More information needed"}
              </p>
              {review.correctedLabel && (
                <p className="text-sm">
                  {hi ? "विशेषज्ञ के अनुसार" : "Expert says"}:{" "}
                  {splitLabel(review.correctedLabel).condition}
                </p>
              )}
              <p className="text-sm text-[var(--crop-green-900)]/85">
                {review.note}
              </p>
            </Card>
          )}
          {!review && d.reviewStatus === "PENDING" && (
            <p className="rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-border">
              ⏳{" "}
              {hi
                ? "विशेषज्ञ इस रिपोर्ट की जांच करेंगे।"
                : "An expert will review this report."}
            </p>
          )}

          {/* B. Main prediction */}
          <Card className="rounded-[24px]">
            <CardHeader>
              <CardTitle>{hi ? "AI नतीजा" : "AI result"}</CardTitle>
              <CardDescription>
                {hi
                  ? "मॉडल स्कोर एक अनुमान है, पक्की पुष्टि नहीं।"
                  : "The model score is an estimate, not a confirmation."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{d.predictedCondition}</span>
                  <span className="text-2xl font-bold tabular-nums">
                    {score}%
                  </span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--crop-green-600)]"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="rounded-xl bg-muted px-3 py-2">
                  {hi ? "गंभीरता" : "Severity"}:{" "}
                  <b>{hi ? "आकलन नहीं" : "Not assessed"}</b>
                </span>
                <span className="rounded-xl bg-muted px-3 py-2">
                  {hi ? "फोटो" : "Photo"}:{" "}
                  <b>
                    {d.qualityStatus === "ok"
                      ? hi
                        ? "ठीक"
                        : "OK"
                      : hi
                        ? "कमज़ोर"
                        : "Weak"}
                  </b>
                </span>
              </div>
              {advisories.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {advisories.map((a) => (
                    <li
                      key={a.code}
                      className="flex gap-2.5 rounded-2xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900 ring-1 ring-amber-200"
                    >
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" />{" "}
                      {ADVISORY[a.code]?.[lang] ?? a.code}
                    </li>
                  ))}
                </ul>
              )}
              {/* H. chart */}
              <div>
                <h3 className="mb-1 text-sm font-semibold text-muted-foreground">
                  {hi ? "मॉडल के शीर्ष अनुमान" : "Top model predictions"}
                </h3>
                <ScoreChart
                  data={d.predictions.map((p) => ({
                    name: splitLabel(p.label).condition,
                    score: Math.round(p.score * 100),
                    top: p.rank === 1,
                  }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* D. Explanation */}
          <Card className="rounded-[24px]">
            <CardHeader>
              <CardTitle>{hi ? "इसका मतलब" : "What this means"}</CardTitle>
              <CardDescription>
                {d.explanationSource === "llm"
                  ? hi
                    ? "AI द्वारा सरल भाषा में, स्वीकृत जानकारी से"
                    : "Simplified by AI from approved guidance"
                  : d.explanationSource === "approved_guidance"
                    ? hi
                      ? "विशेषज्ञ-स्वीकृत जानकारी से"
                      : "From expert-approved guidance"
                    : hi
                      ? "केवल मॉडल नतीजा — स्वीकृत जानकारी अभी उपलब्ध नहीं"
                      : "Model result only — no approved guidance yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-base leading-relaxed">
              <p>{ex?.summary}</p>
              {ex?.condition_explanation && (
                <p className="text-muted-foreground">
                  {ex.condition_explanation}
                </p>
              )}
              {d.knowledge?.symptoms.length ? (
                <div>
                  <h3 className="text-sm font-semibold">
                    {hi
                      ? "आम लक्षण (सामान्य जानकारी)"
                      : "Common symptoms (general information)"}
                  </h3>
                  <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                    {d.knowledge.symptoms.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hi
                      ? "ये लक्षण मॉडल ने अलग से नहीं पहचाने हैं — अपनी फसल से मिलाकर देखें।"
                      : "These symptoms were not individually detected by the model — compare them with your crop."}
                  </p>
                </div>
              ) : null}
              {ex?.possible_causes?.length ? (
                <div>
                  <h3 className="text-sm font-semibold">
                    {hi ? "संभावित कारण" : "Possible causes"}
                  </h3>
                  <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                    {ex.possible_causes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* E. Next actions */}
          <Card className="rounded-[24px]">
            <CardHeader>
              <CardTitle>{hi ? "आगे क्या करें" : "What to do next"}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                {actions.map((a, i) => {
                  const k = KIND[a.kind];
                  return (
                    <li key={`${a.kind}-${i}`} className="flex gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--crop-green-800)] text-sm font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="flex flex-col">
                        <span className="flex items-center gap-1 text-xs font-semibold tracking-wide text-[var(--crop-green-600)] uppercase">
                          <k.icon className="size-3.5" /> {k[lang]}
                        </span>
                        <span className="text-base">{a.text}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              {ex?.sources
                ?.filter((s) => s.url)
                .map((s) => (
                  <a
                    key={s.url}
                    href={s.url!}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 block text-xs text-muted-foreground underline"
                  >
                    {hi ? "स्रोत" : "Source"}: {s.title}
                  </a>
                ))}
            </CardContent>
          </Card>

          {/* C. Visual comparison */}
          <Card className="rounded-[24px]">
            <CardHeader>
              <CardTitle>{hi ? "फोटो तुलना" : "Photo comparison"}</CardTitle>
              <CardDescription>
                {hi
                  ? "संदर्भ फोटो केवल तुलना के लिए हैं, आपकी फसल का सबूत नहीं।"
                  : "Reference photos are for comparison only, not evidence about your crop."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <figure className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/v1/images/diagnoses/${d.id}`}
                  alt=""
                  className="aspect-square rounded-2xl object-cover"
                />
                <figcaption className="text-xs font-medium">
                  {hi ? "आपकी फोटो" : "Your photo"}
                </figcaption>
              </figure>
              {[
                {
                  entry: d.knowledge,
                  label: hi
                    ? `संदर्भ: ${d.predictedCondition}`
                    : `Reference: ${d.predictedCondition}`,
                },
                ...(healthyRef
                  ? [
                      {
                        entry: healthyRef,
                        label: hi
                          ? "संदर्भ: स्वस्थ पौधा"
                          : "Reference: healthy plant",
                      },
                    ]
                  : []),
              ].map(({ entry, label }, i) =>
                entry?.referenceImageKey ? (
                  <figure key={i} className="flex flex-col gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/v1/images/knowledge/${entry.id}`}
                      alt=""
                      className="aspect-square rounded-2xl object-cover"
                    />
                    <figcaption className="text-xs font-medium">
                      {label}
                      {entry.referenceImageCredit
                        ? ` · ${entry.referenceImageCredit}`
                        : ""}
                    </figcaption>
                  </figure>
                ) : (
                  <div
                    key={i}
                    className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-muted p-3 text-center text-xs text-muted-foreground"
                  >
                    <ImageOff className="size-6" />{" "}
                    {hi
                      ? "अभी कोई सत्यापित संदर्भ फोटो नहीं"
                      : "No verified reference photo yet"}
                  </div>
                ),
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-5">
          {/* Mentor: Mitra already knows this report (linked to the conversation on the server) */}
          <Card className="rounded-[24px] border-0 bg-gradient-to-br from-[var(--crop-green-800)] to-[var(--crop-green-950)] text-white ring-0 print:hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5" />{" "}
                {hi
                  ? "मित्र से इस रिपोर्ट के बारे में पूछें"
                  : "Ask Mitra about this report"}
              </CardTitle>
              <CardDescription className="text-white/75">
                {hi
                  ? "आपका AI सलाहकार यह रिपोर्ट और आपकी पिछली जांचें जानता है — बोलकर या लिखकर पूछें।"
                  : "Your AI mentor knows this report and your earlier checks — ask by voice or text."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(hi
                ? [
                    "इस नतीजे का क्या मतलब है?",
                    "सबसे पहले मुझे क्या करना चाहिए?",
                    "इसे फैलने से कैसे रोकूँ?",
                    "दोबारा कब जांच करूँ?",
                  ]
                : [
                    "What does this result mean?",
                    "What should I do first?",
                    "How do I stop it spreading?",
                    "When should I check again?",
                  ]
              ).map((q) => (
                <Link
                  key={q}
                  href={`/farmer/assistant?diagnosis=${d.id}&q=${encodeURIComponent(q)}`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-white/20"
                >
                  {q} <ArrowUpRight className="size-4 shrink-0 opacity-70" />
                </Link>
              ))}
              <Link
                href={`/farmer/assistant?diagnosis=${d.id}`}
                className="mt-1 rounded-xl bg-white px-3.5 py-2.5 text-center text-sm font-semibold text-[var(--crop-green-900)]"
              >
                {hi ? "मित्र खोलें" : "Open Mitra"}
              </Link>
            </CardContent>
          </Card>

          {/* I. Actions */}
          <ReportActions
            id={d.id}
            lang={lang}
            speech={speech}
            shareText={shareText}
            reviewStatus={d.reviewStatus}
            feedback={d.feedback[0]?.helpful ?? null}
          />

          {/* F. Weather context */}
          <Card className="rounded-[24px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudSun className="size-5 text-[var(--crop-green-600)]" />{" "}
                {hi ? "मौसम (संदर्भ)" : "Weather context"}
              </CardTitle>
              <CardDescription>
                {hi
                  ? "केवल मौसम की जानकारी — बीमारी का खतरा नहीं बताती।"
                  : "Context only — this is not a disease-risk prediction."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weather ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Stat
                      icon={Thermometer}
                      label={hi ? "तापमान" : "Temperature"}
                      value={`${weather.temperatureC ?? "—"} °C`}
                    />
                    <Stat
                      icon={Droplets}
                      label={hi ? "नमी" : "Humidity"}
                      value={`${weather.humidityPct ?? "—"} %`}
                    />
                    <Stat
                      icon={CloudSun}
                      label={hi ? "बारिश (24 घं.)" : "Rain (24 h)"}
                      value={`${weather.rainLast24hMm ?? "—"} mm`}
                    />
                    <Stat
                      icon={CloudSun}
                      label={hi ? "बारिश (3 दिन)" : "Rain (3 days)"}
                      value={`${weather.rainLast72hMm ?? "—"} mm`}
                    />
                  </div>
                  {forecast.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                      {forecast.slice(0, 4).map((f) => (
                        <div
                          key={f.date}
                          className="rounded-xl bg-muted px-1 py-2"
                        >
                          <div className="font-semibold">
                            {new Date(f.date).toLocaleDateString(
                              hi ? "hi-IN" : "en-IN",
                              { weekday: "short" },
                            )}
                          </div>
                          <div>
                            {f.maxC ?? "—"}°/{f.minC ?? "—"}°
                          </div>
                          <div className="text-muted-foreground">
                            {f.rainMm ?? 0} mm
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Open-Meteo ·{" "}
                    {weather.observedAt.toLocaleString(hi ? "hi-IN" : "en-IN")}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {hi
                    ? "मौसम देखने के लिए प्रोफ़ाइल में खेत की जगह जोड़ें।"
                    : "Add your farm location in your profile to see weather."}{" "}
                  <Link
                    href="/farmer/profile"
                    className="font-medium text-[var(--crop-green-800)] underline"
                  >
                    {hi ? "जोड़ें" : "Add"}
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          {/* G. Related / similar */}
          {d.predictions.length > 1 && (
            <Card className="rounded-[24px]">
              <CardHeader>
                <CardTitle>
                  {hi ? "मिलती-जुलती स्थितियाँ" : "Similar-looking conditions"}
                </CardTitle>
                <CardDescription>
                  {hi
                    ? "मॉडल ने इन्हें भी संभव माना। विशेषज्ञ इनसे तुलना करेंगे।"
                    : "The model also considered these. An expert can compare them."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {d.predictions.slice(1, 4).map((p) => (
                  <span
                    key={p.id}
                    className="rounded-full bg-muted px-3 py-1.5 text-sm"
                  >
                    {splitLabel(p.label).condition} ·{" "}
                    {Math.round(p.score * 100)}%
                  </span>
                ))}
              </CardContent>
            </Card>
          )}

          {/* J. History for this crop */}
          <Card className="rounded-[24px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sprout className="size-5 text-[var(--crop-green-600)]" />{" "}
                {hi
                  ? `${cropName(d.predictedCrop, lang)} की पिछली जांच`
                  : `Earlier ${cropName(d.predictedCrop, lang)} checks`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length ? (
                <ol className="relative flex flex-col gap-3 border-l-2 border-border pl-4">
                  {history.map((h) => (
                    <li key={h.id}>
                      <Link
                        href={`/farmer/diagnosis/${h.id}`}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span>
                          <span className="block text-xs text-muted-foreground">
                            {h.createdAt.toLocaleDateString(
                              hi ? "hi-IN" : "en-IN",
                              { dateStyle: "medium" },
                            )}
                          </span>
                          {h.predictedCondition}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {Math.round(h.confidence * 100)}%
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="size-4" />{" "}
                  {hi
                    ? "इस फसल की यह पहली जांच है। अगली जांच के बाद बदलाव यहाँ दिखेंगे।"
                    : "This is the first check for this crop. Changes will appear here after your next check."}
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        {hi
          ? "यह AI स्क्रीनिंग है, लैब जांच नहीं। कोई भी दवा इस्तेमाल करने से पहले कृषि विशेषज्ञ से सलाह लें।"
          : "This is an AI screening, not a lab test. Consult an agriculture expert before using any chemical."}{" "}
        · {d.modelName} {d.modelVersion}
      </p>
    </article>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
      <Icon className="size-4 text-[var(--crop-green-600)]" />
      <span className="flex flex-col">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <b>{value}</b>
      </span>
    </div>
  );
}
