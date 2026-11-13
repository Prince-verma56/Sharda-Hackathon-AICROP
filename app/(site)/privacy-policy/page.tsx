import type { Metadata } from 'next';
import { Camera, CloudSun, Globe, KeyRound, MessageSquareText, Mic, ShieldCheck, Smartphone, UserRound, type LucideIcon } from 'lucide-react';
import { DATA_WE_PROCESS, LEGAL_LAST_UPDATED, SERVICE_PROVIDERS, type DataCategory, type DataIcon } from '@/components/marketing/legal/content';
import {
  Callout,
  ContactEmail,
  LegalDocument,
  LegalHelpCard,
  LegalList,
  LegalMeta,
  LegalSummary,
  Strong,
  TextLink,
  type LegalSectionItem,
} from '@/components/marketing/legal/legal-document';
import { PageIntro } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'How CropAI handles your mobile number, profile, crop photos, AI results, voice calls and weather data — explained in plain language, with India’s DPDP Act, 2023 as the framework.',
};

const DATA_ICONS: Record<DataIcon, LucideIcon> = {
  phone: Smartphone,
  profile: UserRound,
  photo: Camera,
  chat: MessageSquareText,
  voice: Mic,
  search: Globe,
  weather: CloudSun,
  security: KeyRound,
};

const AT_A_GLANCE = [
  { title: 'We never sell your data', text: 'No advertising and no data brokers — we share data only with the service providers that help run CropAI.' },
  { title: 'Photos stay private', text: 'Saved without GPS details; only you and authorised staff can open them.' },
  { title: 'Voice is not recorded by CropAI', text: 'Calls run through Vapi; we keep only when a call happened and how long it lasted.' },
  { title: 'You stay in control', text: 'Edit your profile, log out of all devices, or ask us to delete your data.' },
];

function DataCard({ item }: { item: DataCategory }) {
  const Icon = DATA_ICONS[item.icon];
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-[var(--crop-cream)] p-4 ring-1 ring-border sm:p-5">
      <span className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
          <Icon className="size-5" strokeWidth={1.7} />
        </span>
        <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
      </span>
      <p className="text-sm leading-relaxed">{item.what}</p>
      <dl className="mt-auto flex flex-col gap-2.5 border-t border-border pt-3 text-sm leading-relaxed">
        <div>
          <dt className="text-[11px] font-semibold tracking-[0.16em] text-[var(--crop-green-600)] uppercase">Why</dt>
          <dd>{item.why}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold tracking-[0.16em] text-[var(--crop-green-600)] uppercase">How long</dt>
          <dd>{item.kept}</dd>
        </div>
      </dl>
    </li>
  );
}

const SECTIONS: LegalSectionItem[] = [
  {
    id: 'about',
    title: 'Who we are and what this covers',
    content: (
      <>
        <p>
          CropAI (“we”, “us”) is an AI crop-disease screening service for farmers in India. It is available on this website and in the CropAI farmer app, in Hindi and
          English. This policy explains what personal data we process, why, who helps us, and the choices you have. It covers farmers, invited volunteers and staff who
          sign in, and visitors to this website.
        </p>
        <p>
          We use India’s <Strong>Digital Personal Data Protection Act, 2023</Strong> (DPDP Act) and the <Strong>Digital Personal Data Protection Rules, 2025</Strong> as
          the framework for how we handle personal data. This policy describes our practices; it is not a claim of certification or of full legal compliance, and we
          review it as the Rules come into force in phases.
        </p>
      </>
    ),
  },
  {
    id: 'data',
    title: 'What we collect and why',
    content: (
      <>
        <p>We ask only for what the app needs. Apart from your mobile number, everything in your profile is optional.</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {DATA_WE_PROCESS.map((item) => (
            <DataCard key={item.title} item={item} />
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'choices',
    title: 'Your choices and consent',
    content: (
      <>
        <LegalList
          items={[
            <>
              <Strong>Photos.</Strong> Before your first photo is saved, the app asks you to tick a box allowing us to keep it for your report and expert review.
            </>,
            <>
              <Strong>Profile and farm location.</Strong> Optional — you can skip them. GPS is used only when you tap “Use my location”.
            </>,
            <>
              <Strong>Microphone.</Strong> Used only during a voice call that you start.
            </>,
            <>
              <Strong>Chat history.</Strong> Off by default. You can turn on saving of text chats and, separately, of voice-call transcripts in Mitra → History, and turn either off or delete your saved history there at any time.
            </>,
            <>
              <Strong>Cookies.</Strong> Only what the app needs: a sign-in cookie that page scripts cannot read (HttpOnly) and a cookie that remembers your language. No
              advertising or tracking cookies.
            </>,
          ]}
        />
        <p>
          You can withdraw consent at any time — see <TextLink href="/data-rights">your data rights</TextLink>. Withdrawing does not undo processing that already happened,
          but we stop from then on.
        </p>
      </>
    ),
  },
  {
    id: 'ai',
    title: 'How AI is used',
    content: (
      <>
        <LegalList
          items={[
            <>
              <Strong>Photo screening</Strong> runs on our own copy of the AgriSmart India v1 model. Your photos are not sent to outside AI services.
            </>,
            <>
              <Strong>Explanations and text answers</Strong> are written by an AI language-model service using your report, expert-approved guidance and weather context —
              never your phone number or photo.
            </>,
            <>
              <Strong>Experts stay in charge.</Strong> Uncertain results can be queued for review by an invited agronomist, and the original AI output is never changed.
            </>,
            <>
              <Strong>No automated decisions about you.</Strong> CropAI does not decide eligibility for loans, insurance or government schemes.
            </>,
          ]}
        />
        <Callout title="A screening, not a diagnosis">
          AI results are estimates and can be wrong. Confirm with an agronomist, your Krishi Vigyan Kendra (KVK) or agriculture officer before acting. See our{' '}
          <TextLink href="/terms-and-conditions#ai-screening">terms</TextLink>.
        </Callout>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share data with',
    content: (
      <>
        <p>
          <Strong>We do not sell your personal data or use it for advertising.</Strong> We share it only with service providers that help us run CropAI, each receiving
          only what its job needs:
        </p>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl ring-1 ring-border">
          {SERVICE_PROVIDERS.map((provider) => (
            <li key={provider.name} className="grid gap-1 bg-[var(--crop-cream)] px-4 py-3.5 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4 sm:px-5">
              <span className="font-semibold text-foreground">{provider.name}</span>
              <span className="flex flex-col gap-0.5">
                <span>{provider.role}</span>
                <span className="text-xs text-muted-foreground/90">Receives: {provider.receives}</span>
              </span>
            </li>
          ))}
        </ul>
        <LegalList
          items={[
            <>
              <Strong>Hosting.</Strong> Our servers and database store the app’s data.
            </>,
            <>
              <Strong>Invited experts and staff</Strong> see only what their role needs, with phone numbers masked.
            </>,
            <>
              <Strong>Legal reasons.</Strong> We disclose data if the law or a valid order from an authority requires it, or to protect someone’s safety.
            </>,
          ]}
        />
        <p>Some of these providers may process data outside India.</p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep data',
    content: (
      <LegalList
        items={[
          <>
            <Strong>Account and profile:</Strong> until you ask us to delete your account.
          </>,
          <>
            <Strong>Crop photos:</Strong> each photo gets a retention date when uploaded — 90 days by default, set by our administrators. Automatic deletion on that date is
            still being built; until it is live, photos stay with your report unless you ask us to delete them sooner.
          </>,
          <>
            <Strong>Reports and expert reviews:</Strong> kept with your account so your history stays complete, and deleted with it.
          </>,
          <>
            <Strong>Voice and text chats:</Strong> CropAI never stores audio. Chat text and voice transcripts are stored only if you turned saving on, until you turn it off and delete them in Mitra → History; otherwise recent messages are kept for up to 24 hours for context. We keep a basic record that a call happened.
          </>,
          <>
            <Strong>Login codes:</Strong> never stored by CropAI in production. Counters that limit repeated requests expire within an hour.
          </>,
          <>
            <Strong>Sessions:</Strong> end after 30 days (12 hours for administrators), when you log out, or when you use “Log out of all devices”.
          </>,
          <>
            <Strong>Security and audit logs:</Strong> as long as needed to protect the service and meet legal duties, which can be after an account is deleted.
          </>,
        ]}
      />
    ),
  },
  {
    id: 'security',
    title: 'How we protect your data',
    content: (
      <>
        <LegalList
          items={[
            <>
              <Strong>Hashed session tokens.</Strong> Your sign-in token is random, and we store only its SHA-256 hash — a copy of our database cannot be used to sign in as
              you.
            </>,
            <>
              <Strong>Protected cookies.</Strong> The sign-in cookie is HttpOnly and SameSite, and sent only over HTTPS in production.
            </>,
            <>
              <Strong>Role-based access.</Strong> The server checks your role on every page and request; staff see only what their role allows.
            </>,
            <>
              <Strong>Audit logs.</Strong> Sign-ins, new reports, expert reviews and admin changes are logged, so we can see who did what.
            </>,
            <>
              <Strong>Private photo storage.</Strong> Photos are kept outside the public website, without metadata, and served only to authorised users.
            </>,
            <>
              <Strong>Limits on login attempts</Strong> to slow down guessing and misuse.
            </>,
          ]}
        />
        <p>
          No system is perfectly secure. If a personal data breach affects you, we will inform you and report it as the law requires.
        </p>
      </>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    content: (
      <>
        <p>Under the DPDP Act you can:</p>
        <LegalList
          items={[
            'get a summary of the personal data we hold about you and how we use it;',
            'correct, complete or update it;',
            'ask us to delete it;',
            'withdraw consent you gave earlier;',
            'raise a grievance and get a response;',
            'nominate someone to act for you if you die or cannot act yourself.',
          ]}
        />
        <p>
          Some of these work with a button in the app; others need a request to our team for now. <TextLink href="/data-rights">See how to use each right</TextLink>.
        </p>
        <p>
          The law also asks you to give accurate information, not to impersonate anyone, and not to file false complaints.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    content: (
      <p>
        CropAI is meant for adults. Under the DPDP Act a child is anyone under 18, and their data needs verifiable consent from a parent or guardian. We do not knowingly
        allow children to create accounts. If you think a child has signed up, contact us and we will delete the account.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    content: (
      <p>
        When we change this policy we update the “Last updated” date at the top. If a change significantly affects how we use your data, we will tell you in the app
        before it takes effect and ask for your consent again where needed.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact and grievances',
    content: (
      <>
        <p>
          For questions, requests or complaints about your personal data, write to: <ContactEmail />
        </p>
        <p>
          Please include your registered mobile number and what you need. We will reply within the time the law allows. If you are not satisfied with our reply, you may be
          able to complain to the Data Protection Board of India.
        </p>
        <Callout title="Never share your OTP" icon={ShieldCheck}>
          CropAI staff, volunteers and experts will never ask for your one-time code — not even to help with a request.
        </Callout>
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageIntro
        eyebrow="Privacy policy"
        title="Your data, in plain words"
        text="What CropAI collects, why we need it, who helps us run the service, and the choices you have — written to be read, not skimmed past."
      />
      <LegalMeta updated={LEGAL_LAST_UPDATED} items={['Website and farmer app', 'DPDP Act, 2023']} />
      <LegalDocument
        sections={SECTIONS}
        intro={<LegalSummary title="At a glance" points={AT_A_GLANCE} />}
        aside={
          <LegalHelpCard
            title="Want to see, fix or delete your data?"
            text="Each right, step by step — including what you can do in the app today."
            links={[
              { label: 'Your data rights', href: '/data-rights' },
              { label: 'Terms & conditions', href: '/terms-and-conditions' },
            ]}
          />
        }
      />
    </>
  );
}
