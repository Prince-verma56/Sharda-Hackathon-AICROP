import { About } from '@/components/marketing/home/about';
import { SupportedCrops } from '@/components/marketing/home/supported-crops';
import { Card, CardContent } from '@/components/ui/card';
import { PageIntro } from '@/components/marketing/site-chrome';

export const metadata = { title: 'About' };

const PRINCIPLES = [
  ['Real model, real limits', 'Every result comes from the actual AgriSmart India v1 checkpoint (SHA-256 verified). If the model is offline, the app says so — it never invents a result.'],
  ['Experts stay in charge', 'AI screens; agronomists confirm. Treatment advice is used only after a second expert approves a cited source.'],
  ['Privacy by default', 'Phone numbers are masked for staff, photos are stored without location metadata, and voice calls are not recorded.'],
  ['Built for the field', 'Hindi-first, large buttons, voice explanations and short sentences for farmers with limited reading ability.'],
];

export default function AboutPage() {
  return (
    <>
      <PageIntro eyebrow="About" title="An honest AI companion for Indian farmers" text="CropAI combines a pretrained crop-disease classifier, expert review, weather context and a voice assistant into one simple phone experience." />
      <About />
      <section className="mx-auto grid max-w-[88rem] gap-3 px-4 pb-10 sm:grid-cols-2 sm:px-6 lg:px-8">
        {PRINCIPLES.map(([title, text]) => (
          <Card key={title} data-reveal className="rounded-3xl"><CardContent><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></CardContent></Card>
        ))}
      </section>
      <SupportedCrops />
      <p className="mx-auto max-w-[88rem] px-4 pb-12 text-xs leading-relaxed text-muted-foreground sm:px-6 lg:px-8">
        Model: AgriSmart India v1 by the SIH_2026 authors (github.com/wpzvqrs8/SIH_2026), trained on PlantVillage, PlantWild and published research datasets. Licensed for non-commercial research and education because several training datasets are non-commercial. Photos on this site: Unsplash License.
      </p>
    </>
  );
}
