import Link from 'next/link';
import { ArrowUpRight, Mail, Phone, ShieldCheck, Sprout } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageIntro } from '@/components/marketing/site-chrome';
import { getSettings } from '@/server/cropai/settings';

export const metadata = { title: 'Contact' };
export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const settings = await getSettings().catch(() => null);
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const cards = [
    { icon: Sprout, title: 'Farmers', text: 'Sign in with your mobile number to check a crop, talk to Mitra and see your reports.', href: '/login?role=farmer&next=/farmer', cta: 'Open the farmer app' },
    { icon: Phone, title: 'Need urgent help?', text: settings?.support_contact || 'Contact your nearest Krishi Vigyan Kendra (KVK) or district agriculture officer for confirmed advice.', href: null, cta: null },
    { icon: ShieldCheck, title: 'Agronomists & staff', text: 'Invite-only portal for expert review, knowledge approval and monitoring.', href: '/login?role=admin&next=/admin', cta: 'Staff sign in' },
    { icon: Mail, title: 'Partnerships', text: email ? `Write to ${email}` : 'Team contact will be published soon.', href: email ? `mailto:${email}` : null, cta: email ? 'Send email' : null },
  ];
  return (
    <>
      <PageIntro eyebrow="Contact" title="Talk to the team" text="Questions about a report should go to an expert through the app — they can see your photo and the AI result." />
      <section className="mx-auto grid max-w-[88rem] gap-3 px-4 pb-20 sm:grid-cols-2 sm:px-6 lg:px-8">
        {cards.map((c) => (
          <Card key={c.title} data-reveal className="rounded-3xl">
            <CardContent className="flex flex-col gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]"><c.icon className="size-5" /></span>
              <h2 className="text-lg font-semibold">{c.title}</h2>
              <p className="text-sm text-muted-foreground">{c.text}</p>
              {c.href && c.cta && <Link href={c.href} className="flex w-fit items-center gap-1 text-sm font-semibold text-[var(--crop-green-800)]">{c.cta} <ArrowUpRight className="size-4" /></Link>}
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
