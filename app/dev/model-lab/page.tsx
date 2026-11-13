import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SAMPLE_NAME, samplesDir } from '../dev-tools';
import { ModelLab, type SamplePhoto } from './_components/model-lab';

export const metadata: Metadata = {
  title: 'AgriSmart Model Laboratory',
  robots: { index: false, follow: false },
};

/** Reads samples.csv (file,true_label) from the local upstream samples folder, if present. */
async function loadSamples(): Promise<SamplePhoto[]> {
  try {
    const csv = await readFile(path.join(samplesDir(), 'samples.csv'), 'utf8');
    return csv
      .replace(/^﻿/, '')
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim()))
      .filter(([file, label]) => file && label && SAMPLE_NAME.test(file))
      .map(([file, label]) => {
        const [crop, condition = ''] = label.split('___');
        return {
          file,
          url: `/dev/model-lab/samples/${file}`,
          expectedLabel: label,
          title: `${crop.replace(/_\(.*\)|_/g, ' ').trim()} · ${condition.replace(/_/g, ' ').trim()}`,
        };
      });
  } catch {
    return [];
  }
}

export default async function ModelLabPage() {
  const samples = await loadSamples();
  return <ModelLab samples={samples} />;
}
