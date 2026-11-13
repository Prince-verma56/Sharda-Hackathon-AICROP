'use client';

import { cn } from '@/lib/utils';

const ENVELOPE = [0.35, 0.55, 0.75, 0.92, 1, 0.92, 0.75, 0.55, 0.35];

/**
 * Bars driven by a REAL audio level (0..1) from the voice SDK — the farmer's microphone
 * (`local-volume-level`) or Mitra's playback (`volume-level`). No looping fake animation:
 * at silence the bars rest. Reduced-motion users get instant (non-animated) updates.
 */
export function LiveWaveform({
  level,
  tone,
  label,
  light = false,
  className,
}: {
  level: number;
  tone: 'farmer' | 'mitra';
  label: string;
  /** for dark / photo backgrounds */
  light?: boolean;
  className?: string;
}) {
  // SDK levels are small for normal speech; lift them perceptually and clamp.
  const lifted = Math.min(1, Math.sqrt(Math.max(0, level)) * 1.35);
  const color = light ? (tone === 'farmer' ? 'bg-white' : 'bg-[var(--crop-green-200)]') : tone === 'farmer' ? 'bg-[var(--crop-green-600)]' : 'bg-[#c58b2b]';
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lifted * 100)} className={cn('flex h-14 items-center justify-center gap-1.5', className)}>
      {ENVELOPE.map((shape, i) => (
        <span
          key={i}
          className={cn('w-1.5 rounded-full transition-[height,opacity] duration-100 ease-out motion-reduce:transition-none', color)}
          style={{ height: `${Math.round(6 + lifted * 50 * shape)}px`, opacity: 0.35 + lifted * 0.65 }}
        />
      ))}
    </div>
  );
}
