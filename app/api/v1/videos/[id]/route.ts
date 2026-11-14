/**
 * GET /api/v1/videos/:id — streams a volunteer video (HTTP range supported for seeking).
 * Visible to its uploader and staff; to other signed-in users only after an admin approved it.
 * Anything else is 404 (no hint that an unpublished video exists).
 */
import { getAppUser } from '@/server/auth/dal';
import { db } from '@/server/db';
import { fail } from '@/server/http/respond';
import { openVideo } from '@/server/volunteer/video-store';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (!user) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const { id } = await params;
  const video = await db.volunteerVideo.findUnique({ where: { id }, select: { storageKey: true, mimeType: true, status: true, volunteerId: true } });
  const allowed = video && (video.status === 'APPROVED' || video.volunteerId === user.userId || user.adminRole);
  if (!video || !allowed) return fail('NOT_FOUND', 404, 'Video not found.');

  const file = await openVideo(video.storageKey, req.headers.get('range'));
  if (!file) return fail('NOT_FOUND', 404, 'Video not found.');
  if ('invalidRange' in file) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${file.size}` } });
  const headers: Record<string, string> = {
    'Content-Type': video.mimeType,
    'Accept-Ranges': 'bytes',
    'Content-Length': String(file.end - file.start + 1),
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  };
  if (file.partial) headers['Content-Range'] = `bytes ${file.start}-${file.end}/${file.size}`;
  return new Response(file.body, { status: file.partial ? 206 : 200, headers });
}
