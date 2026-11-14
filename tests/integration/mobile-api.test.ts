/**
 * Mobile read APIs against the real PostgreSQL, authenticated exactly like the Flutter app
 * (`Authorization: Bearer <access token>`): ownership (another farmer's report is a 404), cursor
 * pagination, profile, Mitra thread selection, public resources/config.
 *
 * The diagnosis rows below are throwaway fixtures for ownership/shape checks ONLY — they are not
 * model output and say nothing about the AI. Real-model checks live in the mobile acceptance test.
 */
import 'dotenv/config';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const requestHeaders = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => ({ get: (name: string) => requestHeaders.get(name.toLowerCase()) ?? null }),
}));

const enabled = Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;
type Body<T = Record<string, unknown>> = { success: boolean; data: T; error?: { code: string } };

suite('mobile read APIs (integration)', () => {
  let db: typeof import('@/server/db').db;
  let session: typeof import('@/server/auth/session');
  const ids: { a?: string; b?: string; diag: string[] } = { diag: [] };
  const tokens: { a?: string; b?: string } = {};

  const as = (who: 'a' | 'b' | null) => {
    requestHeaders.clear();
    if (who) requestHeaders.set('authorization', `Bearer ${tokens[who]}`);
  };
  const get = (url: string) => new Request(`http://localhost${url}`);

  beforeAll(async () => {
    ({ db } = await import('@/server/db'));
    session = await import('@/server/auth/session');
    const tag = Date.now().toString().slice(-6);
    const a = await db.user.create({ data: { phone: `+9161111${tag}`.slice(0, 13), roles: { create: { role: 'FARMER' } }, farmerProfile: { create: { language: 'en', preferredName: 'Asha', mainCrops: ['tomato'] } } } });
    const b = await db.user.create({ data: { phone: `+9162222${tag}`.slice(0, 13), roles: { create: { role: 'FARMER' } }, farmerProfile: { create: { language: 'hi' } } } });
    ids.a = a.id;
    ids.b = b.id;
    for (let i = 0; i < 3; i++) {
      const d = await db.diagnosis.create({
        data: {
          farmerId: b.id, modelName: 'fixture', modelVersion: 'fixture', modelSha256: 'x', predictedLabel: 'tomato::Late blight', predictedCrop: 'tomato',
          predictedCondition: 'Late blight', isHealthy: false, confidence: 0.6 + i / 10, margin: 0.4, scoreType: 'crop_conditioned_softmax', inferenceMs: 1, latencyMs: 1,
          qualityStatus: 'ok', rawOutput: { fixture: true }, createdAt: new Date(Date.now() - (3 - i) * 60_000),
          predictions: { create: [{ rank: 1, label: 'tomato::Late blight', crop: 'tomato', condition: 'Late blight', score: 0.6 + i / 10, rawScore: 0.5, isHealthy: false }] },
        },
      });
      ids.diag.push(d.id);
    }
    tokens.a = (await session.createSession(a.id, ['FARMER'], 'mobile')).token;
    tokens.b = (await session.createSession(b.id, ['FARMER'], 'mobile')).token;
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: [ids.a, ids.b].filter(Boolean) as string[] } } });
  });

  beforeEach(() => requestHeaders.clear());

  it('report: owner gets the full report; another farmer gets 404; no token gets 401', async () => {
    const { GET } = await import('@/app/api/v1/farmer/diagnoses/[id]/route');
    const params = { params: Promise.resolve({ id: ids.diag[2] }) };

    as('b');
    const own = await GET(get(`/api/v1/farmer/diagnoses/${ids.diag[2]}?lang=en`), params);
    expect(own.status).toBe(200);
    const report = ((await own.json()) as Body<Record<string, any>>).data;  
    expect(report.id).toBe(ids.diag[2]);
    expect(report.result.condition).toBe('Late blight');
    expect(report.result.severity).toBeNull();
    expect(report.result.isLaboratoryConfirmed).toBe(false);
    expect(report.heatmap.available).toBe(false);
    expect(report.image.url).toBe(`/api/v1/images/diagnoses/${ids.diag[2]}`);
    expect(report.predictions[0]).toMatchObject({ rank: 1, condition: 'Late blight' });
    expect(report.history).toHaveLength(3);
    expect(report.history.filter((h: { current: boolean }) => h.current)).toHaveLength(1);
    expect(typeof report.speech.text).toBe('string');

    as('a');
    const other = await GET(get(`/api/v1/farmer/diagnoses/${ids.diag[2]}`), params);
    expect(other.status).toBe(404);

    as(null);
    expect((await GET(get(`/api/v1/farmer/diagnoses/${ids.diag[2]}`), params)).status).toBe(401);
  });

  it('history: newest first with cursor pagination, scoped to the farmer', async () => {
    const { GET } = await import('@/app/api/v1/farmer/diagnoses/route');
    as('b');
    const first = ((await (await GET(get('/api/v1/farmer/diagnoses?limit=2'))).json()) as Body<{ items: { id: string }[]; total: number; nextCursor: string | null }>).data;
    expect(first.total).toBe(3);
    expect(first.items.map((i) => i.id)).toEqual([ids.diag[2], ids.diag[1]]);
    expect(first.nextCursor).toBe(ids.diag[1]);
    const second = ((await (await GET(get(`/api/v1/farmer/diagnoses?limit=2&cursor=${first.nextCursor}`))).json()) as Body<{ items: { id: string }[]; nextCursor: string | null }>).data;
    expect(second.items.map((i) => i.id)).toEqual([ids.diag[0]]);
    expect(second.nextCursor).toBeNull();

    as('a');
    const empty = ((await (await GET(get('/api/v1/farmer/diagnoses'))).json()) as Body<{ items: unknown[]; total: number }>).data;
    expect(empty).toMatchObject({ items: [], total: 0 });
    // B's id is not a valid cursor for A (no probing of other farmers' ids)
    expect((await GET(get(`/api/v1/farmer/diagnoses?cursor=${ids.diag[1]}`))).status).toBe(422);
  });

  it('profile: GET returns the masked phone, crops and consent; PATCH updates language', async () => {
    const route = await import('@/app/api/v1/farmer/profile/route');
    as('a');
    const profile = ((await (await route.GET()).json()) as Body<Record<string, any>>).data;  
    expect(profile.preferredName).toBe('Asha');
    expect(profile.phoneMasked).toContain('•');
    expect(profile.mainCrops).toEqual([{ id: 'tomato', name: 'Tomato' }]);
    expect(profile.consent).toMatchObject({ photos: false, chatHistory: false, voiceTranscripts: false });

    const patch = await route.PATCH(new Request('http://localhost/api/v1/farmer/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ language: 'hi' }) }));
    expect(patch.status).toBe(200);
    const after = ((await (await route.GET()).json()) as Body<{ language: string; mainCrops: { name: string }[] }>).data;
    expect(after.language).toBe('hi');
    expect(after.mainCrops[0].name).toBe('टमाटर');
  });

  it('Mitra thread: a report focus must be owned; consent and voice flags are returned', async () => {
    const { GET } = await import('@/app/api/v1/assistant/thread/route');
    as('a');
    expect((await GET(get(`/api/v1/assistant/thread?diagnosisId=${ids.diag[0]}`))).status).toBe(404);
    as('b');
    const thread = ((await (await GET(get(`/api/v1/assistant/thread?diagnosisId=${ids.diag[0]}&new=1`))).json()) as Body<Record<string, any>>).data;  
    expect(thread.conversationId).toBeNull();
    expect(thread.messages).toEqual([]);
    expect(thread.report).toMatchObject({ id: ids.diag[0], focused: true });
    expect(thread.consent).toEqual({ chatHistory: false, voiceTranscripts: false });
    expect(typeof thread.voiceAvailable).toBe('boolean');
  });

  it('public resources and mobile config contain official links and no secrets', async () => {
    const resources = await import('@/app/api/v1/resources/route');
    const config = await import('@/app/api/v1/mobile/config/route');
    as(null);
    const res = ((await (await resources.GET(get('/api/v1/resources'))).json()) as Body<{ groups: { resources: { url: string | null }[] }[] }>).data;
    expect(res.groups.length).toBeGreaterThan(0);
    for (const g of res.groups) for (const r of g.resources) if (r.url) expect(r.url.startsWith('https://')).toBe(true);

    const raw = await (await config.GET(get('/api/v1/mobile/config'))).text();
    for (const secret of [process.env.VAPI_API_KEY, process.env.TWILIO_AUTH_TOKEN, process.env.AUTH_SECRET, process.env.AI_SERVICE_TOKEN, process.env.VAPI_WEBHOOK_SECRET]) {
      if (secret) expect(raw).not.toContain(secret);
    }
    expect(JSON.parse(raw).data.auth.otpLength).toBe(6);
  });
});
