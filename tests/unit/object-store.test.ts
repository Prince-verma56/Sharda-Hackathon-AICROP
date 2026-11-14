/**
 * Object storage drivers. The S3 driver runs against an in-memory fake of @aws-sdk/client-s3
 * (no network): it checks our request shapes, range handling and "missing → null" behaviour.
 * A live bucket (AWS S3 / Cloudflare R2) is verified at deployment time.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const bucket = new Map<string, { body: Buffer; type?: string }>();
const sent: { name: string; input: Record<string, unknown> }[] = [];

vi.mock('@aws-sdk/client-s3', () => {
  class Command {
    constructor(public input: Record<string, unknown>) {}
  }
  const named = (name: string) => class extends Command { static commandName = name; commandName = name };
  const notFound = () => Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } });
  const toBody = (buf: Buffer) => ({
    transformToByteArray: async () => new Uint8Array(buf),
    transformToWebStream: () => new Blob([new Uint8Array(buf)]).stream(),
  });
  class S3Client {
    constructor(public config: Record<string, unknown>) {}
    async send(cmd: { commandName: string; input: Record<string, unknown> }) {
      sent.push({ name: cmd.commandName, input: cmd.input });
      const key = String(cmd.input.Key);
      const obj = bucket.get(key);
      switch (cmd.commandName) {
        case 'Put':
          if (cmd.input.IfNoneMatch === '*' && obj) throw Object.assign(new Error('exists'), { $metadata: { httpStatusCode: 412 } });
          bucket.set(key, { body: cmd.input.Body as Buffer, type: cmd.input.ContentType as string });
          return {};
        case 'Get': {
          if (!obj) throw notFound();
          const range = (cmd.input.Range as string | undefined)?.match(/^bytes=(\d+)-(\d+)$/);
          if (!range) return { Body: toBody(obj.body), ContentLength: obj.body.length };
          const [s, e] = [Number(range[1]), Number(range[2])];
          return { Body: toBody(obj.body.subarray(s, e + 1)), ContentLength: e - s + 1, ContentRange: `bytes ${s}-${e}/${obj.body.length}` };
        }
        case 'Head':
          if (!obj) throw notFound();
          return { ContentLength: obj.body.length };
        case 'Delete':
          bucket.delete(key);
          return {};
      }
    }
  }
  return { S3Client, PutObjectCommand: named('Put'), GetObjectCommand: named('Get'), HeadObjectCommand: named('Head'), DeleteObjectCommand: named('Delete') };
});

const text = async (stream: ReadableStream) => Buffer.from(await new Response(stream).arrayBuffer()).toString();

describe('object store', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cropai-store-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  beforeEach(() => {
    vi.resetModules();
    bucket.clear();
    sent.length = 0;
  });

  for (const driver of ['local', 's3'] as const) {
    it(`${driver}: put / get / range / size / remove, and rejects unsafe keys`, async () => {
      vi.stubEnv('STORAGE_DRIVER', driver);
      vi.stubEnv('PRIVATE_STORAGE_DIR', dir);
      vi.stubEnv('S3_BUCKET', 'cropai-test');
      const { objectStore } = await import('@/server/storage/object-store');
      const store = objectStore();
      expect(store.driver).toBe(driver);
      const key = `videos/2026/11/${'a'.repeat(24)}${driver}.mp4`;
      await store.put(key, Buffer.from('0123456789'), 'video/mp4');
      expect((await store.get(key))?.toString()).toBe('0123456789');
      expect(await store.size(key)).toBe(10);
      const part = await store.stream(key, { start: 2, end: 5 });
      expect(part).toMatchObject({ size: 10, start: 2, end: 5 });
      expect(await text(part!.body)).toBe('2345');
      await expect(store.put(key, Buffer.from('again'), 'video/mp4')).rejects.toBeTruthy(); // never overwrite
      await store.remove(key);
      expect(await store.get(key)).toBeNull();
      expect(await store.size(key)).toBeNull();
      expect(await store.stream(key)).toBeNull();
      await expect(store.put('../etc/passwd', Buffer.from('x'), 'text/plain')).rejects.toThrow('INVALID_STORAGE_KEY');
      vi.unstubAllEnvs();
    });
  }

  it('s3: sends the bucket, content type and create-only condition', async () => {
    vi.stubEnv('STORAGE_DRIVER', 's3');
    vi.stubEnv('S3_BUCKET', 'cropai-test');
    const { objectStore } = await import('@/server/storage/object-store');
    await objectStore().put(`diagnoses/2026/11/${'b'.repeat(24)}.jpg`, Buffer.from('jpg'), 'image/jpeg');
    expect(sent[0]).toMatchObject({ name: 'Put', input: { Bucket: 'cropai-test', ContentType: 'image/jpeg', IfNoneMatch: '*' } });
    vi.unstubAllEnvs();
  });
});
