/**
 * GET /dev/model-lab/samples/:name — serves a local upstream sample photo to the model lab.
 * Dev-only; filenames are allow-listed by pattern and must exist in the samples folder.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SAMPLE_NAME, isDevToolsEnabled, samplesDir } from '../../../dev-tools';

const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!isDevToolsEnabled() || !SAMPLE_NAME.test(name)) {
    return new Response('Not found', { status: 404 });
  }
  try {
    const bytes = await readFile(path.join(samplesDir(), name));
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': TYPES[path.extname(name).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
