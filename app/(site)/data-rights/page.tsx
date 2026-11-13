import type { Metadata } from 'next';
import { ArrowUpRight, CircleCheck, History, LogOut, Mail, PencilLine, Send, ShieldCheck, Smartphone } from 'lucide-react';
import { DATA_RIGHTS, LEGAL_LAST_UPDATED, type DataRight } from '@/components/marketing/legal/content';
import {
  Callout,
  ContactEmail,
  LegalDocument,
  LegalHelpCard,
  LegalList,
  LegalMeta,
  Strong,
  TextLink,
  type LegalSectionItem,
} from '@/components/marketing/legal/legal-document';
import { SmoothLink } from '@/components/marketing/home/smooth-link';
import { PageIntro } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: 'Your data rights',
  description:
    'How to see, correct or delete your CropAI data, withdraw consent, raise a grievance or nominate someone — what works in the app today and what needs a request.',
};

const QUICK_ACTIONS = [
  { icon: PencilLine, title: 'Edit your profile', text: 'Name, language, farm location, crops', href: '/farmer/profile', mode: 'In the app' },
  { icon: History, title: 'See your reports', text: 'Every photo, AI result and expert review', href: '/farmer/history', mode: 'In the app' },
  { icon: LogOut, title: 'Log out of all devices', text: 'Profile → Account', href: '/farmer/profile', mode: 'In the app' },
  { icon: Send, title: 'Delete data or get a copy', text: 'Send us a request', href: '#request', mode: 'By request' },
] as const;

function QuickActions() {
  return (
    <ul data-reveal className="grid gap-3 sm:grid-cols-2">
      {QUICK_ACTIONS.map((action) => {
        const inApp = action.mode === 'In the app';
        return (
          <li key={action.title}>
            <SmoothLink
              href={action.href}
              className="group flex h-full items-center gap-4 rounded-[24px] bg-white p-4 ring-1 ring-border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(28,46,22,0.45)] sm:p-5"
            >
              <span
                className={
                  inApp
                    ? 'grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]'
                    : 'grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--crop-green-800)] text-white'
                }
              >
                <action.icon className="size-5" strokeWidth={1.8} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[10px] font-semibold tracking-[0.16em] text-[var(--crop-green-600)] uppercase">{action.mode}</span>
                <span className="font-semibold">{action.title}</span>
                <span className="text-sm text-muted-foreground">{action.text}</span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
            </SmoothLink>
          </li>
        );
      })}
    </ul>
  );
}

function RightDetails({ right }: { right: DataRight }) {
  return (
    <>
      <p>{right.summary}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl bg-[var(--crop-cream)] p-4 ring-1 ring-border sm:p-5">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-[var(--crop-green-600)] uppercase">
            <Smartphone className="size-3.5" /> In the app today
          </p>
          {right.inApp.length > 0 ? (
            <ul className="flex flex-col gap-2.5 text-sm leading-relaxed">
              {right.inApp.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-[var(--crop-green-600)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed">There is no button for this yet — please send a request.</p>
          )}
        </div>
        {right.byRequest && (
          <div className="flex flex-col gap-3 rounded-2xl bg-[var(--crop-cream)] p-4 ring-1 ring-border sm:p-5">
            <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-[var(--crop-green-600)] uppercase">
              <Mail className="size-3.5" /> By request
            </p>
            <p className="text-sm leading-relaxed">{right.byRequest}</p>
          </div>
        )}
      </div>
    </>
  );
}

const SECTIONS: LegalSectionItem[] = [
  ...DATA_RIGHTS.map((right) => ({ id: right.id, title: right.title, subtitle: right.hindi, content: <RightDetails right={right} /> })),
  {
    id: 'request',
    title: 'How to send a request',
    subtitle: 'अनुरोध कैसे भेजें',
    content: (
      <>
        <p>
          Write to: <ContactEmail />
        </p>
        <LegalList
          items={[
            <>
              <Strong>Include</Strong> your registered mobile number, the name you use in the app (if any), and what you want — for example, “delete all my photos”.
            </>,
            <>
              <Strong>We check it is really you</Strong> by confirming the request with you on your registered mobile number before we act.
            </>,
            <>
              <Strong>We reply</Strong> within the time the law allows and tell you what we did. If we cannot do something — for example, because the law requires us to
              keep a record — we explain why.
            </>,
            'Volunteers and staff have the same rights for their own data.',
          ]}
        />
        <Callout title="Never send your OTP" icon={ShieldCheck}>
          A request never needs your one-time code, and we will never ask for it.
        </Callout>
        <p>
          Read more in our <TextLink href="/privacy-policy">privacy policy</TextLink>.
        </p>
      </>
    ),
  },
];

export default function DataRightsPage() {
  return (
    <>
      <PageIntro
        eyebrow="Your data rights"
        title="Your data, your say"
        text="India’s Digital Personal Data Protection Act, 2023 gives you rights over your personal data. Here is how to use each one in CropAI — what works in the app today, and what still needs a request to our team."
      />
      <LegalMeta updated={LEGAL_LAST_UPDATED} items={['Farmers, volunteers and staff', 'DPDP Act, 2023']} />
      <LegalDocument
        sections={SECTIONS}
        intro={<QuickActions />}
        aside={
          <LegalHelpCard
            title="Before you write to us"
            text="Most changes to your profile take a few taps. Deleting data, a full copy or nomination need a request."
            links={[
              { label: 'Privacy policy', href: '/privacy-policy' },
              { label: 'Contact', href: '/contact' },
            ]}
          />
        }
      />
    </>
  );
}
