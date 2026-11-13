/**
 * Private image storage for diagnosis photos (local disk, outside /public).
 * Photos are re-encoded with sharp: orientation applied, metadata (EXIF/GPS) removed,
 * long edge capped at 1600 px. Served only through authorised routes.
 */
import 'server-only';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomToken, sha256 } from '@/server/auth/crypto';

const ROOT = path.resolve(process.env.PRIVATE_STORAGE_DIR || path.join(process.cwd(), 'storage', 'private'));
const KEY_PATTERN = /^(diagnoses|knowledge)\/\d{4}\/\d{2}\/[A-Za-z0-9_-]{16,64}\.(jpg|png|webp)$/;

export interface StoredImage {
  key: string;
  sha256: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  metadataStripped: boolean;
}

function resolveKey(key: string) {
  if (!KEY_PATTERN.test(key)) throw new Error('INVALID_STORAGE_KEY');
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error('INVALID_STORAGE_KEY');
  return full;
}

export async function storeImage(input: Buffer, folder: 'diagnoses' | 'knowledge'): Promise<StoredImage> {
  let output = input;
  let width: number | null = null;
  let height: number | null = null;
  let metadataStripped = false;
  try {
    const sharp = (await import('sharp')).default;
    const pipeline = sharp(input, { limitInputPixels: 25_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true });
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    output = data;
    width = info.width;
    height = info.height;
    metadataStripped = true; // sharp drops metadata unless withMetadata() is called
  } catch (error) {
    if (process.env.NODE_ENV === 'production') throw new Error('IMAGE_PROCESSING_UNAVAILABLE');
    console.warn('[image-store] sharp unavailable, storing original bytes:', (error as Error).message);
  }
  const now = new Date();
  const key = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomToken(18)}.jpg`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, output, { flag: 'wx' });
  return { key, sha256: sha256(output), mime: 'image/jpeg', bytes: output.length, width, height, metadataStripped };
}

export async function readImage(key: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKey(key));
  } catch {
    return null;
  }
}

export async function deleteImage(key: string): Promise<void> {
  try {
    await unlink(resolveKey(key));
  } catch {
    // already gone
  }
}
