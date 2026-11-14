/**
 * POST /api/v1/volunteer/videos   multipart: video, thumbnail?, title, description?, language?, crop?
 * GET  /api/v1/volunteer/videos   the signed-in volunteer's own submissions
 *
 * Approved volunteers only. The file is checked by size and magic bytes and stored in private
 * storage (never PostgreSQL); it stays PENDING until an admin approves it. Session cookie or
 * `Authorization: Bearer` (mobile app).
 */
import { z } from 'zod';
import { auditService } from '@/server/audit';
import { getAppUser, workspacesFor } from '@/server/auth/dal';
import { storeImage } from '@/server/cropai/image-store';
import { db } from '@/server/db';
import { fail, limit, ok, rejectCrossSiteUpload } from '@/server/http/respond';
import { deleteVideo, MAX_VIDEO_BYTES, sniffVideo, storeVideo, VIDEO_TYPES } from '@/server/volunteer/video-store';

const meta = z.object({
  title: z.string().trim().min(3, 'Add a title (3+ characters).').max(120),
  description: z.string().trim().max(1000).optional(),
  language: z.enum(['hi', 'en', 'mr', 'pa', 'bn', 'te', 'ta', 'gu', 'kn', 'ml', 'or']).optional(),
  crop: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/).optional(),
});

async function approvedVolunteer() {
  const user = await getAppUser();
  if (!user) return { error: fail('UNAUTHORIZED', 401, 'Please sign in again.') };
  if (!user.roles.includes('VOLUNTEER') || !workspacesFor(user).includes('volunteer')) return { error: fail('FORBIDDEN', 403, 'Volunteers only.') };
  return { user };
}

export async function GET() {
  const auth = await approvedVolunteer();
  if ('error' in auth) return auth.error;
  const videos = await db.volunteerVideo.findMany({
    where: { volunteerId: auth.user.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, title: true, description: true, language: true, crop: true, status: true, reviewNote: true, bytes: true, createdAt: true, thumbnailKey: true },
  });
  return ok({ videos: videos.map(({ thumbnailKey, ...v }) => ({ ...v, url: `/api/v1/videos/${v.id}`, thumbnailUrl: thumbnailKey ? `/api/v1/videos/${v.id}/thumbnail` : null })) });
}

export async function POST(req: Request) {
  const blocked = rejectCrossSiteUpload(req);
  if (blocked) return blocked;
  const auth = await approvedVolunteer();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  if (user.volunteer?.verificationStatus !== 'VERIFIED') return fail('VOLUNTEER_PENDING', 403, 'Your volunteer account is waiting for admin approval.');
  const limited = await limit(req, `volunteer-video:${user.userId}`, 10, 3600);
  if (limited) return limited;
  if (Number(req.headers.get('content-length') ?? 0) > MAX_VIDEO_BYTES + 3 * 1024 * 1024) return fail('VIDEO_TOO_LARGE', 413, 'Videos can be up to 60 MB.');

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('INVALID_FORM', 400, 'Upload the video again.');
  }
  const video = form.get('video');
  if (!(video instanceof Blob) || video.size === 0) return fail('VIDEO_REQUIRED', 422, 'Choose a video file.');
  if (video.size > MAX_VIDEO_BYTES) return fail('VIDEO_TOO_LARGE', 413, 'Videos can be up to 60 MB.');
  const parsed = meta.safeParse({
    title: form.get('title'),
    description: String(form.get('description') ?? '') || undefined,
    language: String(form.get('language') ?? '') || undefined,
    crop: String(form.get('crop') ?? '') || undefined,
  });
  if (!parsed.success) return fail('INVALID_FIELDS', 422, parsed.error.issues[0]?.message ?? 'Check the form.');

  const data = Buffer.from(await video.arrayBuffer());
  const mime = sniffVideo(data.subarray(0, 16));
  if (!mime) return fail('VIDEO_FORMAT_UNSUPPORTED', 415, `Use an MP4, WebM or MOV video (${Object.keys(VIDEO_TYPES).join(', ')}).`);

  const stored = await storeVideo(data, mime);
  let thumbnailKey: string | null = null;
  const thumb = form.get('thumbnail');
  if (thumb instanceof Blob && thumb.size > 0 && thumb.size < 2 * 1024 * 1024 && /^image\/(jpeg|png|webp)$/.test(thumb.type)) {
    thumbnailKey = await storeImage(Buffer.from(await thumb.arrayBuffer()), 'video-thumbs')
      .then((s) => s.key)
      .catch(() => null);
  }
  try {
    const row = await db.volunteerVideo.create({
      data: { volunteerId: user.userId, ...parsed.data, storageKey: stored.key, thumbnailKey, mimeType: mime, bytes: stored.bytes },
    });
    await auditService.audit({ actorId: user.userId, action: 'volunteer_video.submitted', resource: 'volunteer_video', resourceId: row.id, metadata: { bytes: stored.bytes, mime } });
    return ok({ id: row.id, status: row.status }, 201);
  } catch (error) {
    await deleteVideo(stored.key);
    console.error('[volunteer-video] save failed', (error as Error).message);
    return fail('VIDEO_SAVE_FAILED', 500, 'The video could not be saved. Please try again.');
  }
}
