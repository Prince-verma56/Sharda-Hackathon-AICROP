import { CallToAction } from '@/components/marketing/home/cta';
import { HowItWorks } from '@/components/marketing/home/how-it-works';
import { ADVISOR_HREF, PageIntro } from '@/components/marketing/site-chrome';

export const metadata = { title: 'How it works' };

const DETAIL = [
  ['Sign in with your mobile number', 'A 6-digit SMS code — no email or password. Your profile is optional.'],
  ['Choose your crop', 'Pick from 59 crops shown with pictures and Hindi names. Choosing the crop makes the result more reliable.'],
  ['Take one clear leaf photo', 'Daylight, close up, steady. The app checks light and blur before sending.'],
  ['Get the AI screening', 'The AgriSmart India v1 model returns the most likely condition plus alternatives in under a second.'],
  ['Understand and act', 'Simple next steps from expert-approved guidance, local weather context, and Mitra to explain it by voice.'],
  ['Ask an expert', 'One tap sends the report to an agronomist, who confirms or corrects it. You get a notification.'],
];

export default function HowItWorksPage() {
  return (
    <>
      <PageIntro eyebrow="How it works" title="From one photo to a clear next step" text="Designed for farmers who prefer pictures and voice over long text." />
      <HowItWorks />
      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <ol className="flex flex-col gap-3">
          {DETAIL.map(([title, text], i) => (
            <li key={title} data-reveal className="flex gap-4 rounded-3xl bg-white p-5 ring-1 ring-border">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--crop-green-800)] font-semibold text-white">{i + 1}</span>
              <span><b className="block text-base">{title}</b><span className="text-sm text-muted-foreground">{text}</span></span>
            </li>
          ))}
        </ol>
      </section>
      <CallToAction href={ADVISOR_HREF} />
    </>
  );
}
