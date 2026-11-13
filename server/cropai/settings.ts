/** Platform settings editable by SUPER_ADMIN (no secrets are ever stored here). */
import 'server-only';
import { z } from 'zod';
import { db } from '@/server/db';

export const SETTINGS_SCHEMA = z.object({
  image_retention_days: z.number().int().min(7).max(730),
  auto_queue_uncertain_for_review: z.boolean(),
  support_contact: z.string().max(120),
  farmer_notice: z.string().max(280),
});

export type PlatformSettings = z.infer<typeof SETTINGS_SCHEMA>;

export const DEFAULT_SETTINGS: PlatformSettings = {
  image_retention_days: 90,
  auto_queue_uncertain_for_review: true,
  support_contact: '',
  farmer_notice: '',
};

export async function getSettings(): Promise<PlatformSettings> {
  const rows = await db.platformSetting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) if (row.key in DEFAULT_SETTINGS) merged[row.key] = row.value;
  const parsed = SETTINGS_SCHEMA.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(values: PlatformSettings, updatedById: string) {
  const data = SETTINGS_SCHEMA.parse(values);
  await db.$transaction(
    Object.entries(data).map(([key, value]) =>
      db.platformSetting.upsert({ where: { key }, create: { key, value, updatedById }, update: { value, updatedById } }),
    ),
  );
}
