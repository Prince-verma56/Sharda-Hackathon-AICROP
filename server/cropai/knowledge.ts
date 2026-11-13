/** Approved agricultural guidance lookup (only APPROVED entries ever reach farmers). */
import 'server-only';
import type { KnowledgeEntry } from '@prisma/client';
import { cacheProvider } from '@/server/cache';
import { db } from '@/server/db';

const key = (label: string) => `cropai:knowledge:approved:${label}`;

/** The cache stores JSON, which turns Date fields into strings: turn them back into Dates. */
function reviveDates(entry: KnowledgeEntry): KnowledgeEntry {
  const date = (value: unknown) => (value == null ? null : value instanceof Date ? value : new Date(value as string));
  return {
    ...entry,
    createdAt: date(entry.createdAt) ?? new Date(0),
    updatedAt: date(entry.updatedAt) ?? new Date(0),
    reviewedAt: date(entry.reviewedAt),
    lastReviewedAt: date(entry.lastReviewedAt),
  };
}

export async function getApprovedGuidance(conditionLabel: string): Promise<KnowledgeEntry | null> {
  const cached = await cacheProvider.get<KnowledgeEntry | { none: true }>(key(conditionLabel)).catch(() => null);
  if (cached) return 'none' in cached ? null : reviveDates(cached);
  const entry = await db.knowledgeEntry.findFirst({
    where: { conditionLabel, status: 'APPROVED' },
    orderBy: [{ lastReviewedAt: 'desc' }, { updatedAt: 'desc' }],
  });
  await cacheProvider.set(key(conditionLabel), entry ?? { none: true }, 600).catch(() => undefined);
  return entry;
}

export async function invalidateGuidance(conditionLabel: string) {
  await cacheProvider.delete(key(conditionLabel)).catch(() => undefined);
}
