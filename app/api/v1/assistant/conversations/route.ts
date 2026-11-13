/**
 * GET    /api/v1/assistant/conversations  -> the farmer's saved Mitra conversations (latest 10)
 * DELETE /api/v1/assistant/conversations  -> delete all saved Mitra history (messages + cache)
 */
import { deleteMitraHistory, listConversations } from '@/ai/conversation/mitra';
import { auditService } from '@/server/audit';
import { getCurrentFarmer } from '@/server/auth/dal';
import { fail, ok } from '@/server/http/respond';

export async function GET() {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  return ok({ conversations: await listConversations(farmer.userId) });
}

export async function DELETE(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== (req.headers.get('x-forwarded-host') ?? req.headers.get('host'))) {
    return fail('CROSS_SITE_REQUEST', 403, 'Cross-site request blocked.');
  }
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const deleted = await deleteMitraHistory(farmer.userId);
  await auditService.audit({ actorId: farmer.userId, action: 'mitra.history_deleted', resource: 'user', resourceId: farmer.userId, metadata: { conversations: deleted } });
  return ok({ deleted });
}
