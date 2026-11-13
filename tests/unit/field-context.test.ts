/** Optional field details captured with a crop check. */
import { describe, expect, it } from 'vitest';
import { answeredCount, describeFieldContext, deviceTimestamp, FieldContextSchema, sanitizeFieldContext, type FieldContext } from '@/lib/cropai/field-context';

describe('field context', () => {
  it('accepts an empty object (everything is optional) and rejects unknown choices', () => {
    expect(FieldContextSchema.safeParse({}).success).toBe(true);
    expect(FieldContextSchema.safeParse({ cropStage: 'banana' }).success).toBe(false);
  });

  it('rounds the device location to ~1 km before storing', () => {
    const s = sanitizeFieldContext({ location: { latitude: 28.474412, longitude: 77.503987, accuracyM: 23.7 }, note: '  ' });
    expect(s.location).toEqual({ latitude: 28.47, longitude: 77.5, accuracyM: 24 });
    expect(s.note).toBeUndefined();
  });

  it('counts only the farmer answers and describes them in plain English for Mitra', () => {
    const ctx = { cropStage: 'flowering', firstNoticed: 'week', parts: ['leaves', 'fruit'] as FieldContext['parts'], sprayed: 'no', note: 'worse after rain', capturedAt: '2026-11-14T06:48:10+05:30', timeZone: 'Asia/Kolkata' } satisfies FieldContext;
    expect(answeredCount(ctx)).toBe(5);
    expect(describeFieldContext(ctx)).toMatchObject({ crop_stage: 'Flowering', first_noticed: 'About a week', affected_parts: 'Leaves, Fruit', sprayed_last_2_weeks: 'No', farmer_note: 'worse after rain' });
    expect(describeFieldContext({})).toBeNull();
  });

  it('stamps the device local time with its offset', () => {
    const { capturedAt, timeZone } = deviceTimestamp(new Date('2026-11-14T01:18:10Z'));
    expect(capturedAt).toMatch(/^2026-11-1\dT\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(timeZone).toBeTruthy();
  });
});
