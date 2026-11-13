/**
 * Real PostgreSQL: a farmer's assistant tools can never read another farmer's report,
 * even when the other report's id is supplied. Skips when the dev database is not reachable.
 * Creates throwaway rows and deletes them afterwards.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite('farmer data ownership (integration)', () => {
  let db: typeof import('@/server/db').db;
  let runMitraTool: typeof import('@/ai/voice/mitra-tools').runMitraTool;
  const ids: { a?: string; b?: string; diagB?: string } = {};

  beforeAll(async () => {
    ({ db } = await import('@/server/db'));
    ({ runMitraTool } = await import('@/ai/voice/mitra-tools'));
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      return;
    }
    const tag = Date.now().toString().slice(-8);
    const a = await db.user.create({ data: { phone: `+9160000${tag.slice(-5)}`, roles: { create: { role: 'FARMER' } }, farmerProfile: { create: { language: 'en' } } } });
    const b = await db.user.create({ data: { phone: `+9170000${tag.slice(-5)}`, roles: { create: { role: 'FARMER' } }, farmerProfile: { create: { language: 'en' } } } });
    const diag = await db.diagnosis.create({
      data: {
        farmerId: b.id, modelName: 'test', modelVersion: 'test', modelSha256: 'x', predictedLabel: 'tomato::Late blight', predictedCrop: 'tomato',
        predictedCondition: 'Late blight', isHealthy: false, confidence: 0.7, margin: 0.5, scoreType: 'crop_conditioned_softmax', inferenceMs: 1, latencyMs: 1,
        qualityStatus: 'ok', rawOutput: { test: true },
      },
    });
    Object.assign(ids, { a: a.id, b: b.id, diagB: diag.id });
  });

  afterAll(async () => {
    if (ids.a || ids.b) await db.user.deleteMany({ where: { id: { in: [ids.a, ids.b].filter(Boolean) as string[] } } });
  });

  it('does not leak another farmer’s diagnosis through tools', async () => {
    if (!ids.a) return;
    const scope = { farmerId: ids.a, activeDiagnosisId: ids.diagB!, language: 'en' as const };
    const current = await runMitraTool('get_current_diagnosis', { diagnosis_id: ids.diagB }, scope);
    expect(current.diagnosis).toBeNull();
    const history = await runMitraTool('get_previous_diagnoses', {}, scope);
    expect(history.count).toBe(0);
    const expert = await runMitraTool('request_expert_assistance', {}, scope);
    expect(expert.requested).toBe(false);
    const untouched = await db.diagnosis.findUnique({ where: { id: ids.diagB! } });
    expect(untouched?.reviewStatus).toBe('UNREVIEWED');
  });

  it('returns the owner’s own diagnosis', async () => {
    if (!ids.b) return;
    const own = await runMitraTool('get_current_diagnosis', {}, { farmerId: ids.b, activeDiagnosisId: ids.diagB!, language: 'en' });
    expect(own.predicted_condition).toBe('Late blight');
    expect(own.severity).toBe('Not assessed');
  });
});
