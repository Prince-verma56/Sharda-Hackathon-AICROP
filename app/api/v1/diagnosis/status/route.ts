/**
 * GET /api/v1/diagnosis/status
 *
 * Reachability and model status of the private inference service. Never exposes the
 * service URL, token or filesystem paths.
 */
import { getInferenceStatus } from '@/ai/diagnosis';
import { enforceRateLimit, ok } from '@/ai/diagnosis/http';

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const limited = await enforceRateLimit(req, 'status', 120, requestId);
  if (limited) return limited;
  return ok(await getInferenceStatus(), requestId);
}
