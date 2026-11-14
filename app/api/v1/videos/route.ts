/**
 * GET /api/v1/videos?cursor=&limit= — approved volunteer videos for any signed-in user (farmer
 * app and web). Newest first, cursor pagination. Session cookie or `Authorization: Bearer`.
 */
import { getAppUser } from '@/server/auth/dal';
import { db } from '@/server/db';
import { fail, ok } from '@/server/http/respond';

export async function GET(req: Request) {
  const user = await getAppUser();
  if (!user) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const url = new URL(req.url);
  const take = Math.min(30, Math.max(1, Number(url.searchParams.get('limit')) || 12));
  const cursor = url.searchParams.get('cursor');
  const rows = await db.volunteerVideo.findMany({
    where: { status: 'APPROVED' },
    orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, title: true, description: true, language: true, crop: true, thumbnailKey: true, reviewedAt: true, volunteer: { select: { name: true } } },
  });
  const page = rows.slice(0, take);
  return ok({
    videos: page.map(({ thumbnailKey, volunteer, ...v }) => ({ ...v, by: volunteer.name ?? 'CropAI volunteer', url: `/api/v1/videos/${v.id}`, thumbnailUrl: thumbnailKey ? `/api/v1/videos/${v.id}/thumbnail` : null })),
    nextCursor: rows.length > take ? page.at(-1)?.id ?? null : null,
  });
}
