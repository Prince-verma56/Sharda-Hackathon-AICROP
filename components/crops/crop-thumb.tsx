import Image from 'next/image';
import { LeafMark } from '@/components/marketing/home/brand';
import { cn } from '@/lib/utils';

const SIZES = {
  xs: { box: 'size-6 rounded-md', px: 48, icon: 'size-3.5' },
  sm: { box: 'size-7 rounded-lg', px: 56, icon: 'size-4' },
  md: { box: 'size-10 rounded-xl', px: 80, icon: 'size-5' },
  lg: { box: 'size-16 rounded-xl', px: 128, icon: 'size-7' },
} as const;

/**
 * A real crop photo (public/images/crops, licences in CREDITS.md; map from getCropImages()).
 * Falls back to the CropAI leaf mark for crops without a photo — never an emoji.
 */
export function CropThumb({ id, images, size = 'sm', className }: { id: string; images: Record<string, string>; size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  const src = images[id];
  return src ? (
    <Image src={src} alt="" width={s.px} height={s.px} className={cn(s.box, 'shrink-0 object-cover', className)} />
  ) : (
    <span aria-hidden className={cn(s.box, 'grid shrink-0 place-items-center bg-[var(--crop-green-100)] text-[var(--crop-green-600)]', className)}>
      <LeafMark className={s.icon} />
    </span>
  );
}
