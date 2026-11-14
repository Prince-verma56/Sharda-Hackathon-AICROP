/**
 * Private object storage for user files (diagnosis photos, knowledge images, volunteer videos and
 * thumbnails). Keys are validated by the callers' patterns; files are never public.
 *
 *   STORAGE_DRIVER=local (default)  files under PRIVATE_STORAGE_DIR (default ./storage/private) —
 *                                    for development and single-server hosting
 *   STORAGE_DRIVER=s3               any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO): needed on
 *                                    Vercel, whose filesystem is not persistent
 *     S3_BUCKET, S3_REGION (default "auto"), S3_ENDPOINT (R2/MinIO), S3_ACCESS_KEY_ID,
 *     S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE=true (MinIO)
 */
import 'server-only';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

export interface ObjectRange {
  body: ReadableStream;
  size: number;
  start: number;
  end: number;
}

export interface ObjectStore {
  readonly driver: 'local' | 's3';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  /** whole object (no range) or bytes [start, end] inclusive */
  stream(key: string, range?: { start: number; end: number }): Promise<ObjectRange | null>;
  size(key: string): Promise<number | null>;
  remove(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-z-]+\/\d{4}\/\d{2}\/[A-Za-z0-9_-]{16,64}\.[a-z0-9]{2,5}$/;
function assertKey(key: string) {
  if (!SAFE_KEY.test(key)) throw new Error('INVALID_STORAGE_KEY');
}

function localStore(): ObjectStore {
  // Runtime-only location: tell Turbopack not to trace it (otherwise the whole project is bundled).
  const root = path.resolve(/* turbopackIgnore: true */ process.env.PRIVATE_STORAGE_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), 'storage', 'private'));
  const full = (key: string) => {
    assertKey(key);
    const p = path.resolve(root, key);
    if (!p.startsWith(root + path.sep)) throw new Error('INVALID_STORAGE_KEY');
    return p;
  };
  return {
    driver: 'local',
    async put(key, body) {
      const p = full(key);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, body, { flag: 'wx' });
    },
    async get(key) {
      try {
        return await readFile(full(key));
      } catch {
        return null;
      }
    },
    async stream(key, range) {
      let p: string;
      try {
        p = full(key);
      } catch {
        return null;
      }
      const info = await stat(p).catch(() => null);
      if (!info) return null;
      const start = range?.start ?? 0;
      const end = range?.end ?? info.size - 1;
      return { body: Readable.toWeb(createReadStream(p, { start, end })) as ReadableStream, size: info.size, start, end };
    },
    async size(key) {
      try {
        return (await stat(full(key))).size;
      } catch {
        return null;
      }
    },
    async remove(key) {
      try {
        await unlink(full(key));
      } catch {
        // already gone
      }
    },
  };
}

function s3Store(): ObjectStore {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
  // Loaded lazily so local development never imports the AWS SDK.
  const sdk = import('@aws-sdk/client-s3').then((m) => ({
    m,
    client: new m.S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: process.env.S3_ACCESS_KEY_ID ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '' } : undefined,
    }),
  }));
  const missing = (error: unknown) => {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    return e?.name === 'NoSuchKey' || e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
  };
  return {
    driver: 's3',
    async put(key, body, contentType) {
      assertKey(key);
      const { m, client } = await sdk;
      await client.send(new m.PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, IfNoneMatch: '*' }));
    },
    async get(key) {
      assertKey(key);
      const { m, client } = await sdk;
      try {
        const out = await client.send(new m.GetObjectCommand({ Bucket: bucket, Key: key }));
        return out.Body ? Buffer.from(await out.Body.transformToByteArray()) : null;
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },
    async stream(key, range) {
      assertKey(key);
      const { m, client } = await sdk;
      try {
        const out = await client.send(new m.GetObjectCommand({ Bucket: bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }));
        if (!out.Body) return null;
        const total = out.ContentRange ? Number(out.ContentRange.split('/')[1]) : Number(out.ContentLength ?? 0);
        const start = range?.start ?? 0;
        const end = range?.end ?? total - 1;
        return { body: out.Body.transformToWebStream(), size: total, start, end };
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },
    async size(key) {
      assertKey(key);
      const { m, client } = await sdk;
      try {
        return Number((await client.send(new m.HeadObjectCommand({ Bucket: bucket, Key: key }))).ContentLength ?? 0);
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },
    async remove(key) {
      assertKey(key);
      const { m, client } = await sdk;
      await client.send(new m.DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
    },
  };
}

let store: ObjectStore | null = null;

export function objectStore(): ObjectStore {
  if (!store) store = process.env.STORAGE_DRIVER === 's3' ? s3Store() : localStore();
  return store;
}
