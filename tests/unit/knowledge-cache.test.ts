/** Cached approved guidance must come back with real Dates (JSON cache turns them into strings). */
import { describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('@/server/cache', () => ({
  cacheProvider: {
    get: async (k: string) => (store.has(k) ? JSON.parse(JSON.stringify(store.get(k))) : null),
    set: async (k: string, v: unknown) => void store.set(k, v),
    delete: async (k: string) => void store.delete(k),
  },
}));
const entry = { id: 'k1', conditionLabel: 'tomato::Late blight', lastReviewedAt: new Date('2026-11-01T00:00:00Z'), reviewedAt: null, createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-02T00:00:00Z') };
vi.mock('@/server/db', () => ({ db: { knowledgeEntry: { findFirst: vi.fn(async () => entry) } } }));

describe('getApprovedGuidance cache', () => {
  it('returns Date objects on a cache hit', async () => {
    const { getApprovedGuidance } = await import('@/server/cropai/knowledge');
    await getApprovedGuidance('tomato::Late blight'); // miss → stored
    const hit = await getApprovedGuidance('tomato::Late blight'); // hit → revived
    expect(hit?.lastReviewedAt).toBeInstanceOf(Date);
    expect(hit?.lastReviewedAt?.toISOString().slice(0, 10)).toBe('2026-11-01');
    expect(hit?.reviewedAt).toBeNull();
  });
});
