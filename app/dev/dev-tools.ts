import 'server-only';
import path from 'node:path';

export function isDevToolsEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_TOOLS === 'true';
}

/** Local, git-ignored copy of the upstream PlantDoc sample photos (CC BY 4.0). */
export function samplesDir() {
  return process.env.AGRISMART_SAMPLES_DIR
    ? path.resolve(process.env.AGRISMART_SAMPLES_DIR)
    : path.join(process.cwd(), 'ai', 'models', 'agrismart-india', 'upstream', 'samples');
}

export const SAMPLE_NAME = /^[a-z0-9_]{1,80}\.(jpe?g|png|webp)$/;
