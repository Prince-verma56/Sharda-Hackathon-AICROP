/** POST /api/v1/auth/logout  { scope?: "farmer" | "staff", everywhere?: boolean } */
import { z } from 'zod';
import { getCurrentFarmer, getStaffSession } from '@/server/auth/dal';
import { destroyCurrentSession, revokeAllSessions } from '@/server/auth/session';
import { ok, readJson } from '@/server/http/respond';

const schema = z.object({ scope: z.enum(['farmer', 'staff']).default('farmer'), everywhere: z.boolean().default(false) });

export async function POST(req: Request) {
  const body = await readJson(req, schema);
  const { scope, everywhere } = 'data' in body ? body.data : { scope: 'farmer' as const, everywhere: false };
  if (scope === 'staff') {
    const staff = await getStaffSession();
    if (staff && everywhere) await revokeAllSessions(staff.userId);
    await destroyCurrentSession('STAFF');
    return ok({ next: '/admin/login' });
  }
  const farmer = await getCurrentFarmer();
  if (farmer && everywhere) await revokeAllSessions(farmer.userId);
  await destroyCurrentSession('FARMER');
  return ok({ next: '/farmer/login' });
}
