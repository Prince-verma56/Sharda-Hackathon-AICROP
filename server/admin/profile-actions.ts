'use server';

import { revalidatePath } from 'next/cache';
import { auditService } from '@/server/audit';
import { requireStaff } from '@/server/auth/dal';
import { db } from '@/server/db';

/** First-login detail for administrators: their name (shown on expert reviews and in audit logs). */
export async function saveStaffName(form: FormData) {
  const staff = await requireStaff();
  const name = String(form.get('name') ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (name.length < 2) return;
  await db.user.update({ where: { id: staff.userId }, data: { name } });
  await auditService.audit({ actorId: staff.userId, action: 'staff.profile_updated', resource: 'user', resourceId: staff.userId });
  revalidatePath('/admin', 'layout');
}
