import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { brand } from '@/config/brand';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata: Metadata = {
  title: { default: `${brand.name} for farmers`, template: `%s · ${brand.name}` },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#f7f6f1', width: 'device-width', initialScale: 1 };

/** Farmer area: warm theme and large type. Width is handled by the app shell and each page. */
export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`theme-crop ${manrope.variable} flex min-h-dvh flex-1 flex-col bg-[var(--crop-cream)] text-[17px] antialiased`}>
      {children}
    </div>
  );
}
