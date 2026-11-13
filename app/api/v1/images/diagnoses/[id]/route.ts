/** GET /api/v1/images/diagnoses/:id — the diagnosis photo, for its farmer or authorised staff only. */
import { getCurrentFarmer, getCurrentStaff } from '@/server/auth/dal';
import { can } from '@/server/auth/rbac';
import { readImage } from '@/server/cropai/image-store';
import { db } from '@/server/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const diagnosis = await db.diagnosis.findUnique({ where: { id }, select: { farmerId: true, imageKey: true, imageMime: true } });
  if (!diagnosis?.imageKey) return new Response('Not found', { status: 404 });

  const farmer = await getCurrentFarmer();
  const staff = farmer ? null : await getCurrentStaff();
  const allowed = (farmer && farmer.userId === diagnosis.farmerId) || (staff && can(staff.role, 'diagnoses:view'));
  if (!allowed) return new Response('Not found', { status: 404 });

  const bytes = await readImage(diagnosis.imageKey);
  if (!bytes) return new Response('Gone', { status: 410 });
  return new Response(new Uint8Array(bytes), {
    headers: { 'Content-Type': diagnosis.imageMime ?? 'image/jpeg', 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' },
  });
}
