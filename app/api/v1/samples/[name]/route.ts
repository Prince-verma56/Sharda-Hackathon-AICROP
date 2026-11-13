/** GET /api/v1/samples/:name — a sample leaf photo (PlantDoc, CC BY 4.0) for signed-in users. */
import { getAppUser } from '@/server/auth/dal';
import { readSample } from '@/server/cropai/samples';

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!(await getAppUser())) return new Response('Unauthorized', { status: 401 });
  const { name } = await params;
  const bytes = await readSample(name);
  if (!bytes) return new Response('Not found', { status: 404 });
  const type = name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
}
