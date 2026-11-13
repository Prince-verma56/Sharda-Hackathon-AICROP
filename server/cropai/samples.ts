/**
 * Sample leaf photos (PlantDoc, Singh et al. 2020, CC BY 4.0 — local copy of the upstream
 * AgriSmart samples) that signed-in users can pick on the scan screen to try the real model.
 */
import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SAMPLE_NAME, samplesDir } from '@/app/dev/dev-tools';
import { splitLabel } from '@/lib/crops';

export interface SamplePhoto {
  file: string;
  crop: string;
  condition: string;
  url: string;
}

/** "Corn_(maize)___Common_rust_" -> "corn_maize" (matched against the model's crop ids). */
function cropIdFromLabel(label: string, cropIds: string[]): string | null {
  const head = label.split('___')[0] ?? '';
  const normalized = head.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (cropIds.includes(normalized)) return normalized;
  const first = normalized.split('_')[0];
  return cropIds.find((id) => id === first || id.startsWith(`${first}_`)) ?? null;
}

export async function listSamples(cropIds: string[]): Promise<SamplePhoto[]> {
  try {
    const csv = await readFile(path.join(samplesDir(), 'samples.csv'), 'utf8');
    return csv
      .replace(/^﻿/, '')
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim()))
      .filter(([file, label]) => file && label && SAMPLE_NAME.test(file))
      .flatMap(([file, label]) => {
        const crop = cropIdFromLabel(label, cropIds);
        return crop ? [{ file, crop, condition: splitLabel(label).condition, url: `/api/v1/samples/${file}` }] : [];
      });
  } catch {
    return [];
  }
}

export async function readSample(file: string): Promise<Buffer | null> {
  if (!SAMPLE_NAME.test(file)) return null;
  try {
    return await readFile(path.join(samplesDir(), file));
  } catch {
    return null;
  }
}
