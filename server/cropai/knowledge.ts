/** Approved agricultural guidance lookup (only APPROVED entries ever reach farmers). */
import 'server-only';
import type { KnowledgeEntry } from '@prisma/client';
import { cacheProvider } from '@/server/cache';
import { db } from '@/server/db';

const key = (label: string) => `cropai:knowledge:approved:${label}`;

export async function getApprovedGuidance(conditionLabel: string): Promise<KnowledgeEntry | null> {
  const cached = await cacheProvider.get<KnowledgeEntry | { none: true }>(key(conditionLabel)).catch(() => null);
  if (cached) return 'none' in cached ? null : cached;
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
