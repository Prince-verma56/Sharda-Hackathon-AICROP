import Link from 'next/link';
import { BookOpenCheck, Bug, Camera, CloudSun, Languages, Leaf, Mic, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CallToAction } from '@/components/marketing/home/cta';
import { ADVISOR_HREF, PageIntro } from '@/components/marketing/site-chrome';

export const metadata = { title: 'Features' };

const FEATURES = [
  { icon: Leaf, title: 'Disease & pest screening', text: 'AgriSmart India v1 (DINOv2 ViT-B/14) checks one leaf photo against 387 conditions across 59 crops in about a third of a second.', status: 'Live' },
  { icon: Camera, title: 'Guided photo capture', text: 'Big camera button, spoken tips and an on-device light/blur check help farmers take a usable photo first time.', status: 'Live' },
  { icon: ShieldCheck, title: 'Honest results', text: 'Model scores are labelled as estimates, alternatives are shown, and uncertain photos are flagged for an expert — never presented as lab-confirmed.', status: 'Live' },
  { icon: Mic, title: 'Mitra voice assistant', text: 'Farmers can ask questions in Hindi by voice (Vapi) or text. Mitra only uses the farmer’s own report and expert-approved guidance.', status: 'Live' },
  { icon: CloudSun, title: 'Weather context', text: 'Temperature, humidity and rainfall for the farm from Open-Meteo, shown as context — not as an invented disease-risk score.', status: 'Live' },
  { icon: UserRoundCheck, title: 'Expert review', text: 'Agronomists confirm or challenge AI results in a separate staff portal. Farmers are notified; the original model output is never altered.', status: 'Live' },
  { icon: BookOpenCheck, title: 'Approved guidance only', text: 'Prevention and treatment advice comes only from knowledge entries with a cited source, approved by a second expert.', status: 'Live' },
  { icon: Languages, title: 'Hindi-first, voice-friendly', text: 'Large touch targets, minimal reading and spoken explanations for farmers with limited reading ability.', status: 'Hindi + English' },
  { icon: Bug, title: 'Severity & outbreak forecasts', text: 'Not offered: the classifier does not measure severity, and no validated outbreak model exists yet.', status: 'Not assessed' },
];

export default function FeaturesPage() {
  return (
    <>
      <PageIntro eyebrow="Features" title="Everything a farmer needs, nothing they don’t" text="A phone-first crop check that is fast, explained simply and honest about its limits — with experts in the loop." />
      <section className="mx-auto grid max-w-[88rem] gap-3 px-4 pb-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
        {FEATURES.map((f) => (
          <Card key={f.title} data-reveal className="rounded-3xl">
            <CardContent className="flex flex-col gap-3">
              <span className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]"><f.icon className="size-5" /></span>
                <Badge variant={f.status === 'Not assessed' ? 'outline' : 'secondary'} className="tracking-wide uppercase">{f.status}</Badge>
              </span>
              <h2 className="text-lg font-semibold">{f.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <p className="mx-auto max-w-[88rem] px-4 pb-6 text-sm text-muted-foreground sm:px-6 lg:px-8">See the <Link href="/insights" className="font-medium text-[var(--crop-green-800)] underline">model evaluation</Link> for how accurate the screening is in lab and field photos.</p>
      <CallToAction href={ADVISOR_HREF} />
    </>
  );
}
