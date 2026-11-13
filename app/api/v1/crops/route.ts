/**
 * GET /api/v1/crops
 *
 * Crops and disease/condition classes supported by the loaded checkpoint, with the
 * upstream authors' held-out test metrics for context.
 */
import { getCropCatalogue } from '@/ai/diagnosis';
import { enforceAccess, enforceRateLimit, failFromError, ok } from '@/ai/diagnosis/http';

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const denied = (await enforceAccess(requestId)) ?? (await enforceRateLimit(req, 'crops', 60, requestId));
  if (denied) return denied;
  try {
    return ok(await getCropCatalogue(), requestId);
  } catch (error) {
    return failFromError(error, requestId);
  }
}
