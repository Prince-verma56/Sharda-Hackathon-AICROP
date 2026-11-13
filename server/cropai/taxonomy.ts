/** Model taxonomy, cached in Redis (bound to the checkpoint version). */
import 'server-only';
import { getCropCatalogue, type CropCatalogueDto } from '@/ai/diagnosis';
import { cacheProvider } from '@/server/cache';

const CACHE_KEY = 'cropai:taxonomy:v1';

export async function getTaxonomy(): Promise<CropCatalogueDto> {
  const cached = await cacheProvider.get<CropCatalogueDto>(CACHE_KEY).catch(() => null);
  if (cached) return cached;
  const catalogue = await getCropCatalogue();
  await cacheProvider.set(CACHE_KEY, catalogue, 6 * 3600).catch(() => undefined);
  return catalogue;
}

/** Taxonomy if the inference service is reachable; null otherwise (callers show a clear error). */
export async function tryGetTaxonomy(): Promise<CropCatalogueDto | null> {
  try {
    return await getTaxonomy();
  } catch {
    return null;
  }
}

export async function isSupportedCrop(crop: string): Promise<boolean> {
  const taxonomy = await getTaxonomy();
  return taxonomy.crops.some((c) => c.id === crop);
}
