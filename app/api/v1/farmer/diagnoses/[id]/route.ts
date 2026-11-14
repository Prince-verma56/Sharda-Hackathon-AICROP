/**
 * GET /api/v1/farmer/diagnoses/:id?lang=hi|en — the farmer's full crop report (mobile app).
 * Owner only: another farmer's id returns 404 (never 403, so ids cannot be probed).
 */
import { getCurrentFarmer } from '@/server/auth/dal';
import { buildFarmerReport } from '@/server/cropai/report';
import { fail, ok } from '@/server/http/respond';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const { id } = await params;
  if (!/^[a-z0-9]{8,40}$/i.test(id)) return fail('NOT_FOUND', 404, 'Report not found.');
  const q = new URL(req.url).searchParams.get('lang');
  const lang = q === 'hi' || q === 'en' ? q : farmer.language === 'en' ? 'en' : 'hi';
  const report = await buildFarmerReport(id, farmer.userId, lang);
  if (!report) return fail('NOT_FOUND', 404, 'Report not found.');
  return ok(report);
}
