'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ImagePlus,
  Info,
  Leaf,
  Loader2,
  RefreshCw,
  ScanSearch,
  ServerCrash,
  Upload,
  X,
} from 'lucide-react';
import type { CropCatalogueDto, DiagnosisDto, InferenceStatus } from '@/ai/diagnosis/schemas';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface SamplePhoto {
  file: string;
  url: string;
  expectedLabel: string;
  title: string;
}

type ApiEnvelope<T> =
  | { success: true; data: T; meta?: { requestId?: string } }
  | { success: false; error: { code: string; message: string }; meta?: { requestId?: string } };

interface RunRecord {
  id: string;
  fileName: string;
  crop: string | null;
  label: string;
  confidence: number;
  latencyMs: number;
  roundTripMs: number;
  advisories: number;
}

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const AUTO_CROP = '__auto__';

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const titleCase = (value: string) => value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

async function fetchEnvelope<T>(input: RequestInfo, init?: RequestInit): Promise<ApiEnvelope<T>> {
  try {
    const response = await fetch(input, { cache: 'no-store', ...init });
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Could not reach the Next.js server.' } };
  }
}

// ---------------------------------------------------------------------------------------

export function ModelLab({ samples }: { samples: SamplePhoto[] }) {
  const [status, setStatus] = useState<InferenceStatus | null>(null);
  const [catalogue, setCatalogue] = useState<CropCatalogueDto | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [crop, setCrop] = useState<string>(AUTO_CROP);
  const [topK, setTopK] = useState<string>('5');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expectedLabel, setExpectedLabel] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DiagnosisDto | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- service status (polls quickly while offline/loading) ----
  const refreshStatus = useCallback(async () => {
    const envelope = await fetchEnvelope<InferenceStatus>('/api/v1/diagnosis/status');
    if (envelope.success) setStatus(envelope.data);
    else setStatus(null);
  }, []);

  const modelLoaded = Boolean(status?.modelLoaded);
  useEffect(() => {
    let cancelled = false;
    const poll = () =>
      fetchEnvelope<InferenceStatus>('/api/v1/diagnosis/status').then((envelope) => {
        if (!cancelled) setStatus(envelope.success ? envelope.data : null);
      });
    poll();
    const timer = setInterval(poll, modelLoaded ? 30000 : 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [modelLoaded]);

  // ---- crop catalogue, once the model is loaded ----
  useEffect(() => {
    if (!status?.modelLoaded || catalogue) return;
    fetchEnvelope<CropCatalogueDto>('/api/v1/crops').then((envelope) => {
      if (envelope.success) {
        setCatalogue(envelope.data);
        setCatalogueError(null);
      } else {
        setCatalogueError(envelope.error.message);
      }
    });
  }, [status?.modelLoaded, catalogue]);

  const cropItems = useMemo(
    () => [
      { value: AUTO_CROP, label: 'Auto-detect (no crop hint)' },
      ...(catalogue?.crops ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.classCount} classes` })),
    ],
    [catalogue],
  );
  const selectedCrop = catalogue?.crops.find((c) => c.id === crop) ?? null;

  // ---- file handling ----
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const acceptFile = useCallback((next: File | null, expected: string | null = null) => {
    setResult(null);
    setError(null);
    setFileError(null);
    if (!next) {
      setFile(null);
      setPreviewUrl(null);
      setExpectedLabel(null);
      return;
    }
    if (next.type && !ACCEPTED.includes(next.type)) {
      setFileError(`Unsupported file type "${next.type}". Use JPEG, PNG or WebP.`);
      return;
    }
    if (next.size > MAX_BYTES) {
      setFileError(`File is ${(next.size / 1024 / 1024).toFixed(1)} MB; the limit is 8 MB.`);
      return;
    }
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setExpectedLabel(expected);
  }, []);

  const loadSample = useCallback(
    async (sample: SamplePhoto) => {
      const response = await fetch(sample.url);
      if (!response.ok) {
        setFileError('Sample photo is not available locally.');
        return;
      }
      const blob = await response.blob();
      acceptFile(new File([blob], sample.file, { type: blob.type || 'image/jpeg' }), sample.expectedLabel);
      const cropGuess = sample.expectedLabel.split('___')[0].toLowerCase().replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
      if (catalogue?.crops.some((c) => c.id === cropGuess)) setCrop(cropGuess);
    },
    [acceptFile, catalogue],
  );

  // ---- predict ----
  const predict = useCallback(async () => {
    if (!file) return;
    setRunning(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.set('image', file, file.name);
    if (crop !== AUTO_CROP) form.set('crop', crop);
    form.set('topK', topK);
    const envelope = await fetchEnvelope<DiagnosisDto>('/api/v1/diagnosis', { method: 'POST', body: form });
    setRunning(false);
    if (!envelope.success) {
      setError(envelope.error);
      refreshStatus();
      return;
    }
    const d = envelope.data;
    setResult(d);
    setRuns((previous) =>
      [
        {
          id: d.requestId,
          fileName: file.name,
          crop: d.selectedCrop,
          label: d.predictedLabel,
          confidence: d.confidence,
          latencyMs: d.latencyMs,
          roundTripMs: d.roundTripMs,
          advisories: d.assessment.advisories.length,
        },
        ...previous,
      ].slice(0, 12),
    );
    refreshStatus();
  }, [file, crop, topK, refreshStatus]);

  const canPredict = Boolean(file) && !running && Boolean(status?.modelLoaded);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
      <LabHeader status={status} onRefresh={refreshStatus} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ---------------- Input ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Choose a crop hint, then upload a single leaf photo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Crop</label>
                {catalogue ? (
                  <Select items={cropItems} value={crop} onValueChange={(v) => setCrop((v as string) ?? AUTO_CROP)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {cropItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Skeleton className="h-8 w-full" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Top-k</label>
                <Select
                  items={['3', '5', '10'].map((v) => ({ value: v, label: `Top ${v}` }))}
                  value={topK}
                  onValueChange={(v) => setTopK((v as string) ?? '5')}
                >
                  <SelectTrigger className="w-full sm:w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['3', '5', '10'].map((v) => (
                      <SelectItem key={v} value={v}>
                        Top {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {catalogueError && (
              <p className="text-xs text-destructive">Crop list unavailable: {catalogueError}</p>
            )}
            {selectedCrop && (
              <p className="text-xs text-muted-foreground">
                {selectedCrop.classes.map((c) => c.name).join(' · ')}
                {selectedCrop.upstreamMetrics && (
                  <>
                    {' '}
                    — upstream test macro-F1 {selectedCrop.upstreamMetrics.macroF1.toFixed(2)} on{' '}
                    {selectedCrop.upstreamMetrics.testImages.toLocaleString()} photos
                  </>
                )}
              </p>
            )}

            {/* Drop zone / preview */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload a leaf photo"
              onClick={() => !file && inputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !file) inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                acceptFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={cn(
                'relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors',
                dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/40',
                !file && 'cursor-pointer hover:border-primary/60 hover:bg-muted/60',
              )}
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img src={previewUrl} alt="Selected leaf photo" className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 px-6 text-center text-sm text-muted-foreground">
                  <ImagePlus className="size-8" />
                  <span className="font-medium text-foreground">Drop a photo here or click to browse</span>
                  <span className="text-xs">JPEG, PNG or WebP · up to 8 MB · at least 64 px</span>
                </div>
              )}
              {file && (
                <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="max-w-[60%] truncate">
                    {file.name} · {(file.size / 1024).toFixed(0)} KB
                  </Badge>
                  <div className="flex gap-1">
                    <Button size="xs" variant="secondary" onClick={() => inputRef.current?.click()}>
                      <Upload /> Replace
                    </Button>
                    <Button size="icon-xs" variant="secondary" aria-label="Remove photo" onClick={() => acceptFile(null)}>
                      <X />
                    </Button>
                  </div>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED.join(',')}
                className="hidden"
                onChange={(e) => {
                  acceptFile(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
            </div>
            {fileError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>File rejected</AlertTitle>
                <AlertDescription>{fileError}</AlertDescription>
              </Alert>
            )}

            <Button size="lg" className="w-full" disabled={!canPredict} onClick={predict}>
              {running ? <Loader2 className="animate-spin" /> : <ScanSearch />}
              {running ? 'Running model…' : 'Run diagnosis'}
            </Button>
            {!status?.modelLoaded && (
              <p className="text-center text-xs text-muted-foreground">
                Prediction is disabled until the inference service reports a loaded model.
              </p>
            )}

            {samples.length > 0 && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Upstream sample photos</span>
                    <Tooltip>
                      <TooltipTrigger render={<span className="cursor-help text-muted-foreground" />}>
                        <Info className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>
                        PlantDoc (Singh et al., 2020), CC BY 4.0, via the SIH_2026 repository. Smoke-test
                        photos only — not an accuracy measurement.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {samples.map((sample) => (
                      <button
                        key={sample.file}
                        type="button"
                        onClick={() => loadSample(sample)}
                        className="group flex flex-col gap-1 text-left"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- dev-only local samples */}
                        <img
                          src={sample.url}
                          alt={sample.title}
                          className="aspect-square w-full rounded-lg border object-cover transition group-hover:ring-2 group-hover:ring-primary"
                        />
                        <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                          {sample.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ---------------- Result ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>Real output from AgriSmart India v1 via Next.js → FastAPI.</CardDescription>
            {result && (
              <CardAction>
                <Badge variant="outline" className="font-mono">
                  {result.requestId.slice(0, 8)}
                </Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {running && <ResultSkeleton />}
            {!running && error && <ErrorPanel error={error} onRetry={canPredict ? predict : undefined} />}
            {!running && !error && result && <ResultPanel result={result} expectedLabel={expectedLabel} />}
            {!running && !error && !result && (
              <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <Leaf className="size-8" />
                Upload a photo and run the diagnosis to see the model output.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {runs.length > 0 && <RunHistory runs={runs} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------

function LabHeader({ status, onRefresh }: { status: InferenceStatus | null; onRefresh: () => void }) {
  const service = !status
    ? { label: 'Checking…', tone: 'secondary' as const }
    : !status.reachable
      ? { label: 'Backend offline', tone: 'destructive' as const }
      : { label: 'Backend connected', tone: 'default' as const };
  const model = !status?.reachable
    ? 'Model unknown'
    : status.modelLoaded
      ? 'Model loaded'
      : status.status === 'loading'
        ? 'Model loading…'
        : `Model unavailable${status.errorCode ? ` (${status.errorCode})` : ''}`;

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Leaf className="size-3.5" /> Internal · development only
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">AgriSmart Model Laboratory</h1>
        <p className="text-sm text-muted-foreground">
          End-to-end test console for the crop disease classifier. Not the farmer-facing app.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={service.tone}>
          {status?.reachable ? <CheckCircle2 /> : <ServerCrash />}
          {service.label}
        </Badge>
        <Badge variant={status?.modelLoaded ? 'secondary' : 'outline'}>
          {status?.status === 'loading' && <Loader2 className="animate-spin" />}
          {model}
        </Badge>
        {status?.modelVersion && <Badge variant="outline">{status.modelVersion}</Badge>}
        {status?.device && (
          <Badge variant="outline">
            <Cpu /> {status.device.toUpperCase()}
          </Badge>
        )}
        {status?.mode === 'real' && <Badge variant="outline">Real inference</Badge>}
        <Button size="icon-sm" variant="ghost" aria-label="Refresh status" onClick={onRefresh}>
          <RefreshCw />
        </Button>
      </div>
    </header>
  );
}

function ResultSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <div className="flex flex-col gap-3 pt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}

const ERROR_HINTS: Record<string, string> = {
  INFERENCE_OFFLINE: 'Start it with: cd ai/services/inference; .venv\\Scripts\\python -m uvicorn app.main:app --port 8001',
  INFERENCE_NOT_CONFIGURED: 'Set AI_SERVICE_TOKEN (same value for Next.js and FastAPI) and AI_INFERENCE_BASE_URL in .env.local.',
  MODEL_UNAVAILABLE: 'The service is running but the checkpoint failed to load. Check the FastAPI logs.',
  MODEL_LOADING: 'Wait a few seconds for the model to finish loading.',
};

function ErrorPanel({ error, onRetry }: { error: { code: string; message: string }; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <ServerCrash />
      <AlertTitle>{error.message}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span className="font-mono text-xs">{error.code}</span>
        {ERROR_HINTS[error.code] && <span className="text-xs">{ERROR_HINTS[error.code]}</span>}
        {onRetry && (
          <Button size="sm" variant="outline" className="w-fit" onClick={onRetry}>
            <RefreshCw /> Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

function normaliseExpected(label: string) {
  return label.toLowerCase().replace(/[^a-z]/g, '');
}

function ResultPanel({ result, expectedLabel }: { result: DiagnosisDto; expectedLabel: string | null }) {
  const top = result.topPredictions[0];
  const reviewTone = result.assessment.advisories.length > 0;
  const matchesExpected =
    expectedLabel &&
    normaliseExpected(expectedLabel.split('___')[1] ?? '') === normaliseExpected(result.predictedCondition);

  return (
    <div className="flex flex-col gap-5">
      {/* Headline */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={result.isHealthy ? 'secondary' : 'destructive'}>
            {result.isHealthy ? 'Healthy' : 'Disease / pest detected'}
          </Badge>
          <Badge variant="outline">{titleCase(result.predictedCrop)}</Badge>
          <Badge variant="outline">
            Crop {result.cropSource === 'user' ? 'selected by user' : 'inferred by model'}
          </Badge>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{result.predictedCondition}</h2>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              Model score ({result.scoreType === 'crop_conditioned_softmax' ? 'within selected crop' : 'all 387 classes'})
            </span>
            <span className="font-mono font-medium tabular-nums">{pct(result.confidence)}</span>
          </div>
          <Progress value={result.confidence * 100} />
          <span className="text-xs text-muted-foreground">
            Global score {pct(top.rawScore)} · margin over #2 {pct(result.margin)}
            {result.globalTop.label !== top.label && (
              <> · global top: {result.globalTop.label.replace('::', ' · ')} ({pct(result.globalTop.rawScore)})</>
            )}
            {result.selectedCropMass !== null && <> · selected-crop mass {pct(result.selectedCropMass)}</>}
          </span>
        </div>
        {expectedLabel && (
          <p className={cn('text-xs', matchesExpected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
            Sample ground truth: {expectedLabel.replace(/_+/g, ' ').trim()} — {matchesExpected ? 'matches' : 'does not match'} top prediction
          </p>
        )}
      </div>

      {/* Assessment */}
      <Alert className={cn(reviewTone && 'border-amber-500/50')}>
        <AlertTriangle className={cn(reviewTone ? 'text-amber-500' : 'text-muted-foreground')} />
        <AlertTitle>Review required — screening result, not a laboratory diagnosis</AlertTitle>
        <AlertDescription className="flex flex-col gap-1.5">
          {result.assessment.advisories.length === 0 && (
            <span>No additional advisories. Scores are uncalibrated model outputs; no out-of-distribution detector is active.</span>
          )}
          {result.assessment.advisories.map((a) => (
            <span key={a.code} className="flex flex-col">
              <span>{a.message}</span>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                {a.code} · basis: {a.basis.replace(/_/g, ' ')}
              </span>
            </span>
          ))}
        </AlertDescription>
      </Alert>

      {/* Top-k */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Top {result.topPredictions.length} predictions</h3>
        <ol className="flex flex-col gap-2.5">
          {result.topPredictions.map((p, index) => (
            <li key={p.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{index + 1}</span>
                  {p.condition}
                  {p.crop !== result.predictedCrop && (
                    <span className="text-muted-foreground"> · {titleCase(p.crop)}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {p.upstreamMetrics && (
                    <Tooltip>
                      <TooltipTrigger
                        render={<span className="cursor-help font-mono text-[11px] text-muted-foreground" />}
                      >
                        P {p.upstreamMetrics.precision.toFixed(2)}
                      </TooltipTrigger>
                      <TooltipContent>
                        Upstream held-out test: precision {p.upstreamMetrics.precision.toFixed(2)}, recall{' '}
                        {p.upstreamMetrics.recall.toFixed(2)}, {p.upstreamMetrics.support} photos
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <span className="w-14 text-right font-mono tabular-nums">{pct(p.score)}</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', index === 0 ? 'bg-primary' : 'bg-primary/40')}
                  style={{ width: `${Math.max(p.score * 100, 0.5)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Separator />

      {/* Secondary details */}
      <div className="grid gap-5 sm:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Crop evidence (global)</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {result.cropScores.map((c) => (
              <li key={c.crop} className="flex justify-between gap-2">
                <span className={cn(c.crop === result.selectedCrop && 'font-medium')}>{titleCase(c.crop)}</span>
                <span className="font-mono tabular-nums text-muted-foreground">{pct(c.score)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            Photo quality <span className="font-normal text-muted-foreground">(heuristic)</span>
          </h3>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Size</dt>
            <dd className="font-mono tabular-nums">
              {result.imageQuality.width}×{result.imageQuality.height}
            </dd>
            <dt className="text-muted-foreground">Brightness</dt>
            <dd className="font-mono tabular-nums">{result.imageQuality.brightness}</dd>
            <dt className="text-muted-foreground">Sharpness</dt>
            <dd className="font-mono tabular-nums">{result.imageQuality.sharpness}</dd>
          </dl>
          {result.imageQuality.warnings.map((w) => (
            <p key={w.code} className="text-xs text-amber-600 dark:text-amber-400">
              {w.message}
            </p>
          ))}
        </section>
      </div>

      <Separator />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <Metric label="Inference" value={`${result.inferenceMs} ms`} />
        <Metric label="Service total" value={`${result.latencyMs} ms`} />
        <Metric label="Round trip (Next.js)" value={`${result.roundTripMs} ms`} />
        <Metric label="Device" value={result.device.toUpperCase()} />
        <Metric label="Model" value={result.modelVersion} />
        <Metric label="Checkpoint" value={`${result.modelSha256.slice(0, 12)}…`} />
        <Metric label="Mode" value={result.inferenceMode} />
        <Metric label="Preprocessing" value={result.preprocessing.replace('timm-', '')} />
      </dl>
      <p className="text-xs text-muted-foreground">{result.disclaimer}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono">{value}</dd>
    </div>
  );
}

function RunHistory({ runs }: { runs: RunRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session runs</CardTitle>
        <CardDescription>Kept in this browser tab only. Not stored anywhere.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-3 font-medium">File</th>
              <th className="py-1.5 pr-3 font-medium">Crop hint</th>
              <th className="py-1.5 pr-3 font-medium">Top prediction</th>
              <th className="py-1.5 pr-3 text-right font-medium">Score</th>
              <th className="py-1.5 pr-3 text-right font-medium">Inference</th>
              <th className="py-1.5 text-right font-medium">Round trip</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-t">
                <td className="max-w-40 truncate py-1.5 pr-3">{run.fileName}</td>
                <td className="py-1.5 pr-3">{run.crop ? titleCase(run.crop) : <span className="text-muted-foreground">auto</span>}</td>
                <td className="py-1.5 pr-3">
                  {run.label.replace('::', ' · ').replace(/^\w/, (c) => c.toUpperCase())}
                  {run.advisories > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {run.advisories} advisory
                    </Badge>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{pct(run.confidence)}</td>
                <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{run.latencyMs} ms</td>
                <td className="py-1.5 text-right font-mono tabular-nums">{run.roundTripMs} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
