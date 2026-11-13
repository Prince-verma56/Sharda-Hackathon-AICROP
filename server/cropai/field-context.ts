/**
 * Storage for a check's optional field details (diagnoses."fieldContext", JSONB).
 * Raw SQL on purpose: it keeps working in a dev server whose generated Prisma client predates the
 * column (no crash until a restart), and the value is always validated before it is written.
 */
import 'server-only';
import { FieldContextSchema, sanitizeFieldContext, type FieldContext } from '@/lib/cropai/field-context';
import { db } from '@/server/db';

export async function saveFieldContext(diagnosisId: string, context: FieldContext): Promise<void> {
  const value = JSON.stringify(sanitizeFieldContext(FieldContextSchema.parse(context)));
  await db.$executeRaw`UPDATE "diagnoses" SET "fieldContext" = ${value}::jsonb WHERE "id" = ${diagnosisId}`;
}

export async function getFieldContexts(diagnosisIds: string[]): Promise<Map<string, FieldContext>> {
  const out = new Map<string, FieldContext>();
  if (!diagnosisIds.length) return out;
  try {
    const rows = await db.$queryRaw<{ id: string; fieldContext: unknown }[]>`SELECT "id", "fieldContext" FROM "diagnoses" WHERE "id" = ANY(${diagnosisIds}) AND "fieldContext" IS NOT NULL`;
    for (const row of rows) {
      const parsed = FieldContextSchema.safeParse(row.fieldContext);
      if (parsed.success) out.set(row.id, parsed.data);
    }
  } catch (error) {
    console.warn('[field-context] read failed', (error as Error).message.split('\n')[0]);
  }
  return out;
}

export async function getFieldContext(diagnosisId: string): Promise<FieldContext | null> {
  return (await getFieldContexts([diagnosisId])).get(diagnosisId) ?? null;
}
