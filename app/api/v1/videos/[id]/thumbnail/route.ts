/** GET /api/v1/videos/:id/thumbnail — same visibility rules as the video itself. */
import { getAppUser } from '@/server/auth/dal';
import { readImage } from '@/server/cropai/image-store';
import { db } from '@/server/db';
import { fail } from '@/server/http/respond';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (!user) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const { id } = await params;
  const video = await db.volunteerVideo.findUnique({ where: { id }, select: { thumbnailKey: true, status: true, volunteerId: true } });
  const allowed = video && (video.status === 'APPROVED' || video.volunteerId === user.userId || user.adminRole);
  if (!video?.thumbnailKey || !allowed) return fail('NOT_FOUND', 404, 'Thumbnail not found.');
  const image = await readImage(video.thumbnailKey);
  if (!image) return fail('NOT_FOUND', 404, 'Thumbnail not found.');
  return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
}
