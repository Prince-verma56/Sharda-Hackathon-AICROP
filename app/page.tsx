import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { About } from '@/components/marketing/home/about';
import { CallToAction } from '@/components/marketing/home/cta';
import { Hero } from '@/components/marketing/home/hero';
import { HomeMotion } from '@/components/marketing/home/home-motion';
import { HowItWorks } from '@/components/marketing/home/how-it-works';
import { SiteFooter } from '@/components/marketing/home/site-footer';
import { SiteHeader } from '@/components/marketing/home/site-header';
import { StatsBand } from '@/components/marketing/home/stats-band';
import { SupportedCrops } from '@/components/marketing/home/supported-crops';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata: Metadata = {
  title: 'CropAI — Smarter Farming. Greener Tomorrow.',
  description:
    'AI-powered crop disease and pest detection for Indian farmers: 59 crops, 387 diseases and conditions, results in under a second.',
};

/**
 * Where "Try AI Advisor" / "Get Started" lead. The farmer-facing diagnosis flow is not
 * built yet, so development points at the working model lab; production goes to sign-up.
 */
function advisorHref() {
  const devTools = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_TOOLS === 'true';
  return devTools ? '/dev/model-lab' : '/register';
}

export default function HomePage() {
  const href = advisorHref();
  return (
    <div className={`theme-crop ${manrope.variable} relative flex min-h-screen flex-col overflow-x-clip antialiased`}>
      <SiteHeader advisorHref={href} />
      <main className="flex-1">
        <Hero advisorHref={href} />
        <About />
        <HowItWorks />
        <StatsBand />
        <SupportedCrops />
        <CallToAction href={href} />
      </main>
      <SiteFooter />
      <HomeMotion />
    </div>
  );
}
