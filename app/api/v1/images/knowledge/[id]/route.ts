/** GET /api/v1/images/knowledge/:id — expert-uploaded reference photo (approved entries for farmers). */
import { getCurrentFarmer, getCurrentStaff } from '@/server/auth/dal';
import { readImage } from '@/server/cropai/image-store';
import { db } from '@/server/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await db.knowledgeEntry.findUnique({ where: { id }, select: { referenceImageKey: true, status: true } });
  if (!entry?.referenceImageKey) return new Response('Not found', { status: 404 });
  const staff = await getCurrentStaff();
  const farmer = staff ? null : await getCurrentFarmer();
  if (!staff && !(farmer && entry.status === 'APPROVED')) return new Response('Not found', { status: 404 });
  const bytes = await readImage(entry.referenceImageKey);
  if (!bytes) return new Response('Gone', { status: 410 });
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
}
