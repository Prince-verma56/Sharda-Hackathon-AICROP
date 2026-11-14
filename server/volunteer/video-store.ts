/**
 * Private storage for volunteer videos (local disk outside /public, like diagnosis photos —
 * never inside PostgreSQL). Served only through authorised routes with HTTP range support so
 * phones can seek. Files are checked by their magic bytes, not just the declared type.
 */
import 'server-only';
import { randomToken } from '@/server/auth/crypto';
import { objectStore } from '@/server/storage/object-store';

const KEY_PATTERN = /^videos\/\d{4}\/\d{2}\/[A-Za-z0-9_-]{16,64}\.(mp4|webm|mov)$/;

export const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' } as const;
export type VideoMime = keyof typeof VIDEO_TYPES;
/** 60 MB by default; set VOLUNTEER_VIDEO_MAX_MB lower where the host limits request bodies (Vercel ≈ 4.5 MB). */
export const MAX_VIDEO_BYTES = Math.max(1, Number(process.env.VOLUNTEER_VIDEO_MAX_MB) || 60) * 1024 * 1024;

const checkKey = (key: string) => KEY_PATTERN.test(key);

/** The container format from the first bytes (MP4/MOV: "ftyp" box; WebM: EBML header). */
export function sniffVideo(head: Uint8Array): VideoMime | null {
  if (head.length >= 12 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
    return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'video/webm';
  return null;
}

export async function storeVideo(data: Buffer, mime: VideoMime): Promise<{ key: string; bytes: number }> {
  const now = new Date();
  const key = `videos/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomToken(18)}.${VIDEO_TYPES[mime]}`;
  await objectStore().put(key, data, mime);
  return { key, bytes: data.length };
}

/** Reads a whole file or a byte range ("bytes=start-end" / "bytes=start-" / "bytes=-suffix"). */
export async function openVideo(key: string, rangeHeader: string | null) {
  if (!checkKey(key)) return null;
  const size = await objectStore().size(key);
  if (size == null) return null;
  const match = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && (match[1] || match[2])) {
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start > end || start >= size) return { size, invalidRange: true as const };
    const part = await objectStore().stream(key, { start, end });
    return part ? { ...part, partial: true as const } : null;
  }
  const whole = await objectStore().stream(key);
  return whole ? { ...whole, partial: false as const } : null;
}

export async function deleteVideo(key: string): Promise<void> {
  if (checkKey(key)) await objectStore().remove(key);
}
