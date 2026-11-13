/**
 * POST /api/v1/farmer/diagnoses/:id/actions
 *   { action: "feedback", helpful: boolean, comment? }
 *   { action: "request_expert", message? }
 */
import { z } from 'zod';
import { auditService } from '@/server/audit';
import { getCurrentFarmer } from '@/server/auth/dal';
import { db } from '@/server/db';
import { fail, ok, readJson } from '@/server/http/respond';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('feedback'), helpful: z.boolean(), comment: z.string().max(500).optional() }),
  z.object({ action: z.literal('request_expert'), message: z.string().max(500).optional() }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const { id } = await params;
  const diagnosis = await db.diagnosis.findFirst({ where: { id, farmerId: farmer.userId }, select: { id: true, reviewStatus: true } });
  if (!diagnosis) return fail('NOT_FOUND', 404, 'Report not found.');
  const body = await readJson(req, schema);
  if ('error' in body) return body.error;

  if (body.data.action === 'feedback') {
    await db.diagnosisFeedback.upsert({
      where: { diagnosisId_farmerId: { diagnosisId: id, farmerId: farmer.userId } },
      create: { diagnosisId: id, farmerId: farmer.userId, helpful: body.data.helpful, comment: body.data.comment || null },
      update: { helpful: body.data.helpful, comment: body.data.comment || null },
    });
    return ok({ saved: true });
  }

  if (diagnosis.reviewStatus === 'CONFIRMED' || diagnosis.reviewStatus === 'CHALLENGED') {
    return ok({ status: diagnosis.reviewStatus, alreadyReviewed: true });
  }
  await db.diagnosis.update({ where: { id }, data: { reviewStatus: 'PENDING', reviewRequestedAt: new Date() } });
  await auditService.audit({ actorId: farmer.userId, action: 'diagnosis.expert_requested', resource: 'diagnosis', resourceId: id });
  return ok({ status: 'PENDING' });
}
