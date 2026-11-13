/** GET /api/v1/geo/search?q=village — place lookup (Open-Meteo geocoding, India only). */
import { getCurrentFarmer } from '@/server/auth/dal';
import { searchPlaces } from '@/server/cropai/weather';
import { fail, limit, ok } from '@/server/http/respond';

export async function GET(req: Request) {
  if (!(await getCurrentFarmer())) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const limited = await limit(req, 'geo-search', 30);
  if (limited) return limited;
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2 || q.length > 80) return fail('QUERY_INVALID', 422, 'Type at least 2 letters.');
  try {
    return ok({ results: await searchPlaces(q) });
  } catch {
    return fail('GEOCODING_UNAVAILABLE', 503, 'Place search is unavailable right now.');
  }
}
