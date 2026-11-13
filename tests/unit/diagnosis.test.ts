/**
 * Next.js side of the AgriSmart diagnosis integration: route validation, upstream
 * response validation and error mapping. The FastAPI service is replaced by a stubbed
 * fetch here; real-model tests live in ai/services/inference/tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TOKEN = 'x'.repeat(40);

function upstreamDiagnosis(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    request_id: 'req-12345678',
    model: 'agrismart-india-v1',
    model_version: 'india-model-v1',
    model_sha256: 'ffaffb1e3ca0a81831454e8268b11cf2d16b418838042b023ad188f79e61a08a',
    inference_mode: 'real',
    device: 'cpu',
    crop: 'tomato',
    crop_source: 'user',
    predicted_crop: 'tomato',
    predicted_class: 'Late blight',
    predicted_label: 'tomato::Late blight',
    is_healthy: false,
    confidence: 0.9,
    margin: 0.85,
    global_top: { label: 'tomato::Late blight', raw_score: 0.8 },
    score_type: 'crop_conditioned_softmax',
    top_predictions: [
      { label: 'tomato::Late blight', crop: 'tomato', class: 'Late blight', score: 0.9, raw_score: 0.8, is_healthy: false, upstream_metrics: null },
    ],
    crop_scores: [{ crop: 'tomato', score: 0.88 }],
    selected_crop_mass: 0.88,
    image_quality: { status: 'ok', method: 'heuristic', width: 640, height: 480, brightness: 120, contrast: 50, sharpness: 300, warnings: [] },
    assessment: { status: 'REVIEW_REQUIRED', reasons: ['NO_OOD_DETECTOR'], advisories: [] },
    is_laboratory_confirmed: false,
    preprocessing: 'timm-bicubic-crop0.9-224-tta-mirror-v1',
    latency_ms: 400,
    inference_ms: 380,
    disclaimer: 'Model output.',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function imageForm(bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), type = 'image/jpeg', extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set('image', new File([bytes], 'leaf.jpg', { type }));
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return form;
}

function post(form: FormData) {
  return new Request('http://localhost/api/v1/diagnosis', { method: 'POST', body: form });
}

describe('diagnosis integration', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('AI_SERVICE_TOKEN', TOKEN);
    vi.stubEnv('AI_INFERENCE_BASE_URL', 'http://inference.test:8001');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('forwards image, crop and topK with the server-only bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(upstreamDiagnosis()));
    const { POST } = await import('@/app/api/v1/diagnosis/route');
    const response = await POST(post(imageForm(undefined, 'image/jpeg', { crop: 'Tomato', topK: '3' })));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.predictedLabel).toBe('tomato::Late blight');
    expect(body.data.inferenceMode).toBe('real');
    expect(body.data.topPredictions[0].condition).toBe('Late blight');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://inference.test:8001/v1/predict');
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
    const sent = init.body as FormData;
    expect(sent.get('crop')).toBe('tomato');
    expect(sent.get('top_k')).toBe('3');
    expect(sent.get('image')).toBeInstanceOf(Blob);
  });

  it('never exposes the token or service URL in the response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(upstreamDiagnosis()));
    const { POST } = await import('@/app/api/v1/diagnosis/route');
    const text = await (await POST(post(imageForm()))).text();
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain('inference.test');
  });

  it('rejects requests without an image before calling the service', async () => {
    const { POST } = await import('@/app/api/v1/diagnosis/route');
    const form = new FormData();
    form.set('crop', 'tomato');
    const response = await POST(post(form));
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('IMAGE_REQUIRED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported declared image types', async () => {
    const { POST } = await import('@/app/api/v1/diagnosis/route');
    const response = await POST(post(imageForm(new Uint8Array([1, 2, 3]), 'image/gif')));
    expect(response.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects oversize uploads', async () => {
    const { POST } = await import('@/app/api/v1/diagnosis/route');
    const response = await POST(post(imageForm(new Uint8Array(8 * 1024 * 1024 + 1))));
    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed crop ids and topK values', async () => {
    const { POST } = await import('@/app/api/v1/diagnosis/route');
    expect((await POST(post(imageForm(undefined, 'image/jpeg', { crop: '../etc' })))).status).toBe(422);
    expect((await POST(post(imageForm(undefined, 'image/jpeg', { topK: '50' })))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a connection failure to INFERENCE_OFFLINE (503)', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const { POST } = await import('@/app/api/v1/diagnosis/route');
    const response = await POST(post(imageForm()));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('INFERENCE_OFFLINE');
  });

  it('maps a timeout to INFERENCE_TIMEOUT (504)', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));
    const { POST } = await import('@/app/api/v1/diagnosis/route');
    const response = await POST(post(imageForm()));
    expect(response.status).toBe(504);
  });

  it('passes through known upstream error codes and statuses', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, error: { code: 'CROP_UNSUPPORTED', message: 'x', request_id: 'r' } }, 422),
    );
    const { POST } = await import('@/app/api/v1/diagnosis/route');
    const response = await POST(post(imageForm(undefined, 'image/jpeg', { crop: 'durian' })));
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('CROP_UNSUPPORTED');
  });

  it('collapses unknown upstream errors and never forwards upstream messages', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, error: { code: 'TRACEBACK', message: 'C:\\secret\\path.py line 3' } }, 500),
    );
    const { POST } = await import('@/app/api/v1/diagnosis/route');
    const response = await POST(post(imageForm()));
    const text = await response.text();
    expect(response.status).toBe(502);
    expect(text).toContain('INFERENCE_FAILED');
    expect(text).not.toContain('secret');
  });

  it('refuses upstream payloads that are not real-model outputs', async () => {
    fetchMock.mockResolvedValue(jsonResponse(upstreamDiagnosis({ inference_mode: 'mock' })));
    const { POST } = await import('@/app/api/v1/diagnosis/route');
    const response = await POST(post(imageForm()));
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe('INFERENCE_BAD_RESPONSE');
  });

  it('reports INFERENCE_NOT_CONFIGURED when the token is missing', async () => {
    vi.stubEnv('AI_SERVICE_TOKEN', '');
    const { POST } = await import('@/app/api/v1/diagnosis/route');
    const response = await POST(post(imageForm()));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('INFERENCE_NOT_CONFIGURED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('status endpoint reports offline without throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const { GET } = await import('@/app/api/v1/diagnosis/status/route');
    const response = await GET(new Request('http://localhost/api/v1/diagnosis/status'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ reachable: false, status: 'offline', modelLoaded: false });
  });
});
