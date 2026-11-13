/** Read models for the admin portal — all real PostgreSQL aggregates, no fixtures. */
import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/server/db';

export async function getOverview() {
  const since7 = new Date(Date.now() - 7 * 86_400_000);
  const [farmers, farms, diagnoses, diagnoses7, pending, cropsUsed, recent, feedback] = await Promise.all([
    db.user.count({ where: { roles: { some: { role: 'FARMER' } } } }),
    db.farm.count(),
    db.diagnosis.count(),
    db.diagnosis.count({ where: { createdAt: { gte: since7 } } }),
    db.diagnosis.count({ where: { reviewStatus: { in: ['PENDING', 'NEEDS_INFO'] } } }),
    db.diagnosis.groupBy({ by: ['predictedCrop'] }),
    db.diagnosis.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, createdAt: true, predictedCrop: true, predictedCondition: true, confidence: true, reviewStatus: true } }),
    db.diagnosisFeedback.groupBy({ by: ['helpful'], _count: true }),
  ]);
  const helpful = feedback.find((f) => f.helpful)?._count ?? 0;
  const notHelpful = feedback.find((f) => !f.helpful)?._count ?? 0;
  return {
    farmers,
    farms,
    diagnoses,
    diagnoses7,
    pending,
    cropsUsed: cropsUsed.length,
    recent,
    feedback: { helpful, notHelpful, total: helpful + notHelpful },
  };
}

export async function getAnalytics(days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const where = { createdAt: { gte: since } };
  const [daily, crops, conditions, reviews, total, uncertain, activeFarmers, voice, explanationSources, latency] = await Promise.all([
    db.$queryRaw<{ day: Date; count: bigint }[]>(Prisma.sql`
      SELECT date_trunc('day', "createdAt") AS day, count(*)::bigint AS count
      FROM diagnoses WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`),
    db.diagnosis.groupBy({ by: ['predictedCrop'], where, _count: true, orderBy: { _count: { predictedCrop: 'desc' } }, take: 10 }),
    db.diagnosis.groupBy({ by: ['predictedLabel'], where, _count: true, orderBy: { _count: { predictedLabel: 'desc' } }, take: 10 }),
    db.diagnosis.groupBy({ by: ['reviewStatus'], where, _count: true }),
    db.diagnosis.count({ where }),
    db.diagnosis.count({ where: { ...where, NOT: { advisories: { equals: [] } } } }),
    db.diagnosis.groupBy({ by: ['farmerId'], where }),
    db.conversation.findMany({ where: { channel: 'voice', createdAt: { gte: since } }, select: { metadata: true } }),
    db.diagnosis.groupBy({ by: ['explanationSource'], where, _count: true }),
    db.diagnosis.aggregate({ where, _avg: { inferenceMs: true, latencyMs: true, confidence: true } }),
  ]);

  // Fill missing days with zero so the series is continuous.
  const byDay = new Map(daily.map((d) => [d.day.toISOString().slice(0, 10), Number(d.count)]));
  const series = Array.from({ length: days }, (_, i) => {
    const date = new Date(since.getTime() + (i + 1) * 86_400_000).toISOString().slice(0, 10);
    return { date, count: byDay.get(date) ?? 0 };
  });
  const durations = voice.map((v) => (v.metadata as { durationSeconds?: number } | null)?.durationSeconds).filter((d): d is number => typeof d === 'number');

  return {
    days,
    total,
    series,
    crops: crops.map((c) => ({ crop: c.predictedCrop, count: c._count })),
    conditions: conditions.map((c) => ({ label: c.predictedLabel, count: c._count })),
    reviews: reviews.map((r) => ({ status: r.reviewStatus, count: r._count })),
    uncertainRate: total ? uncertain / total : null,
    activeFarmers: activeFarmers.length,
    perFarmer: activeFarmers.length ? total / activeFarmers.length : null,
    voiceSessions: voice.length,
    voiceAvgSeconds: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    explanationSources: explanationSources.map((e) => ({ source: e.explanationSource ?? 'none', count: e._count })),
    avgInferenceMs: latency._avg.inferenceMs,
    avgLatencyMs: latency._avg.latencyMs,
    avgScore: latency._avg.confidence,
  };
}

export interface DiagnosisFilters {
  q?: string;
  crop?: string;
  review?: string;
  sort?: 'newest' | 'oldest' | 'score_asc' | 'score_desc';
  page?: number;
}

export const PAGE_SIZE = 20;

export async function listDiagnoses(filters: DiagnosisFilters) {
  const where: Prisma.DiagnosisWhereInput = {
    ...(filters.crop ? { predictedCrop: filters.crop } : {}),
    ...(filters.review ? { reviewStatus: filters.review as Prisma.EnumReviewStatusFilter['equals'] } : {}),
    ...(filters.q ? { OR: [{ predictedCondition: { contains: filters.q, mode: 'insensitive' } }, { predictedLabel: { contains: filters.q, mode: 'insensitive' } }, { id: filters.q }] } : {}),
  };
  const orderBy: Prisma.DiagnosisOrderByWithRelationInput =
    filters.sort === 'oldest' ? { createdAt: 'asc' } : filters.sort === 'score_asc' ? { confidence: 'asc' } : filters.sort === 'score_desc' ? { confidence: 'desc' } : { createdAt: 'desc' };
  const page = Math.max(1, filters.page ?? 1);
  const [rows, count] = await Promise.all([
    db.diagnosis.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, createdAt: true, predictedCrop: true, predictedCondition: true, confidence: true, modelVersion: true, reviewStatus: true, isHealthy: true, advisories: true, farmer: { select: { id: true, phone: true, farmerProfile: { select: { preferredName: true } } } } },
    }),
    db.diagnosis.count({ where }),
  ]);
  return { rows, count, page, pages: Math.max(1, Math.ceil(count / PAGE_SIZE)) };
}
