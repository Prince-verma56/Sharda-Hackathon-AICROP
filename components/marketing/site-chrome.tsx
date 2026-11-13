import { Manrope } from 'next/font/google';
import { HomeMotion } from '@/components/marketing/home/home-motion';
import { SiteFooter } from '@/components/marketing/home/site-footer';
import { SiteHeader } from '@/components/marketing/home/site-header';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

/**
 * Where "Try AI Advisor" / "Check your crop" lead: our phone-OTP login with the farmer tab, landing
 * on the scan page afterwards. Signed-in users skip the form (/login -> /auth/continue -> /farmer/scan).
 */
export const ADVISOR_HREF = '/login?role=farmer&next=/farmer/scan';

/** Public site shell: theme, header, footer and motion. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className={`theme-crop ${manrope.variable} relative flex min-h-screen flex-col overflow-x-clip antialiased`}>
      <SiteHeader advisorHref={ADVISOR_HREF} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <HomeMotion />
    </div>
  );
}

/** Header block used by the inner public pages. */
export function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <section className="mx-auto max-w-[88rem] px-4 pt-[120px] pb-10 sm:px-6 lg:px-8 lg:pt-[150px]">
      <p data-reveal className="text-xs font-semibold tracking-[0.22em] text-[var(--crop-green-600)] uppercase">{eyebrow}</p>
      <h1 data-reveal className="mt-4 max-w-4xl text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95] font-semibold tracking-[-0.04em] uppercase">{title}</h1>
      <p data-reveal className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{text}</p>
    </section>
  );
}
