import type { Metadata } from 'next';
import { About } from '@/components/marketing/home/about';
import { CallToAction } from '@/components/marketing/home/cta';
import { Hero } from '@/components/marketing/home/hero';
import { HowItWorks } from '@/components/marketing/home/how-it-works';
import { StatsBand } from '@/components/marketing/home/stats-band';
import { SupportedCrops } from '@/components/marketing/home/supported-crops';
import { ADVISOR_HREF, SiteChrome } from '@/components/marketing/site-chrome';
import { brand } from '@/config/brand';

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description:
    'AI-powered crop disease and pest screening for Indian farmers: 59 crops, 387 diseases and conditions, explained in simple Hindi and by voice.',
};

export default function HomePage() {
  return (
    <SiteChrome>
      <Hero advisorHref={ADVISOR_HREF} />
      <About />
      <HowItWorks />
      <StatsBand />
      <SupportedCrops />
      <CallToAction href={ADVISOR_HREF} />
    </SiteChrome>
  );
}
