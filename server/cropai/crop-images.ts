/**
 * Real crop photos (public/images/crops/manifest.json, free licences with credits in CREDITS.md).
 * Returns {} until the manifest exists, so callers fall back to a neutral icon.
 */
import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

let cached: Record<string, string> | null = null;

export async function getCropImages(): Promise<Record<string, string>> {
  if (cached) return cached;
  try {
    const raw = JSON.parse(await readFile(path.join(process.cwd(), 'public', 'images', 'crops', 'manifest.json'), 'utf8')) as Record<string, { file?: string }>;
    const map = Object.fromEntries(Object.entries(raw).flatMap(([id, entry]) => (typeof entry?.file === 'string' && entry.file.startsWith('/images/crops/') ? [[id, entry.file]] : [])));
    if (Object.keys(map).length) cached = map;
    return map;
  } catch {
    return {};
  }
}
