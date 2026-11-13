import type { Metadata } from 'next';
import { ShieldAlert, TriangleAlert } from 'lucide-react';
import { LEGAL_LAST_UPDATED } from '@/components/marketing/legal/content';
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
  title: 'Terms and conditions',
  description:
    'The rules for using CropAI: phone-OTP accounts, AI crop screening as a screening aid (not a diagnosis), no pesticide doses from the AI, expert review, acceptable use and your rights under Indian law.',
};

const SHORT_VERSION = [
  { title: 'A screening aid, not a diagnosis', text: 'Confirm with an agronomist, your KVK or agriculture officer before you act.' },
  { title: 'No spray doses from the AI', text: 'Treatment advice comes only from expert-approved guidance. Always follow the label.' },
  { title: 'Your OTP is yours alone', text: 'Never share it — not with staff, volunteers or anyone else.' },
  { title: 'Your photos stay yours', text: 'You allow us to use them only to run the service for you.' },
];

const SECTIONS: LegalSectionItem[] = [
  {
    id: 'about',
    title: 'About these terms',
    content: (
      <>
        <p>
          These terms are the agreement between you and CropAI (“we”, “us”) for using the CropAI website and farmer app (the “service”). By signing in or using the
          service, you agree to them. Please also read our <TextLink href="/privacy-policy">privacy policy</TextLink>, which explains how we handle your data.
        </p>
        <p>
          CropAI is an independent project. It is not run by, affiliated with or endorsed by the Government of India or any government department.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Who can use CropAI',
    content: (
      <LegalList
        items={[
          'You must be 18 years or older.',
          'Farmers sign in with an Indian mobile number that can receive SMS.',
          'One person per account, using their own number. Please give accurate information.',
          'Volunteer, expert and staff workspaces are by invitation only.',
        ]}
      />
    ),
  },
  {
    id: 'account',
    title: 'Your account and one-time codes',
    content: (
      <>
        <p>
          You sign in with your mobile number and a one-time code (OTP) sent by SMS. There is no password, so the code is the key to your account.
        </p>
        <Callout title="Never share your OTP" icon={ShieldAlert} tone="strong">
          CropAI staff, volunteers and experts will never ask for your code. Anyone who has it can get into your account and see your reports.
        </Callout>
        <LegalList
          items={[
            <>
              If you lose your phone or think someone else used your account, open <Strong>Profile → Log out of all devices</Strong> and contact us.
            </>,
            'You are responsible for what is done with your account, unless someone got in through no fault of yours.',
            'If you change your mobile number, contact us so we can move your account.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'ai-screening',
    title: 'AI screening is not a diagnosis',
    content: (
      <>
        <p>
          CropAI’s results come from an AI model (AgriSmart India v1) that compares your leaf photo with patterns learned from training photos. It shows the most
          likely condition, some alternatives and a model score.
        </p>
        <LegalList
          items={[
            <>
              <Strong>Results are estimates and can be wrong</Strong> — especially for unclear photos, unusual crops or problems the model was not trained on. A model score
              is not certainty and not a laboratory result.
            </>,
            'The app does not measure how severe a problem is and does not forecast outbreaks.',
            'Weather is shown as context, not as a disease-risk prediction. Web results in Mitra are marked as not expert-verified.',
          ]}
        />
        <Callout title="Always confirm before you act" icon={TriangleAlert} tone="strong">
          CropAI is not a substitute for an agronomist, your Krishi Vigyan Kendra (KVK) or your agriculture officer. Check with them before you spend money, spray or remove
          a crop.
        </Callout>
      </>
    ),
  },
  {
    id: 'treatment',
    title: 'No pesticide doses from the AI',
    content: (
      <>
        <p>
          CropAI’s AI does not prescribe pesticides or give spray doses. It is instructed never to invent product names or doses, and sentences with doses are removed from
          web results before Mitra uses them.
        </p>
        <p>Treatment information appears only when it comes from an expert-approved guidance entry with a cited source.</p>
        <LegalList
          items={[
            'Before using any chemical, read the label and leaflet, and follow your agriculture officer’s or KVK’s advice.',
            <>
              Use only products registered for use in India — see the plant-protection links on our <TextLink href="/resources">government resources</TextLink> page.
            </>,
            'If someone is exposed to a pesticide and feels unwell, get medical help immediately.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'expert-review',
    title: 'Expert review',
    content: (
      <LegalList
        items={[
          'When experts are available, you can ask for a report to be reviewed. Uncertain results may also be sent for review automatically.',
          'Experts are invited agronomists and reviewers. They see your report and photo; your phone number is masked.',
          'Reviews depend on expert availability, so we cannot promise a time. Experts work from your photo and cannot inspect your field, so their view is guidance too.',
          'The original AI result is never changed. The expert’s conclusion is shown next to it.',
        ]}
      />
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    content: (
      <>
        <p>Use CropAI for its purpose — checking crops and learning about farming. Please do not:</p>
        <LegalList
          items={[
            'upload photos of people, identity documents or anything other than plants;',
            'upload illegal, abusive or misleading content, or photos you have no right to share;',
            'try to get into other people’s accounts or data, or sign in with someone else’s number;',
            'attack, overload, scan or reverse-engineer the service, or use bots and scrapers;',
            'use Mitra to seek harmful information or to harass anyone;',
            'present CropAI results as an official government, laboratory or insurance certificate.',
          ]}
        />
        <p>We may remove content or suspend accounts that break these rules.</p>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Your photos and content',
    content: (
      <>
        <p>Your photos, questions and feedback remain yours.</p>
        <p>
          You give CropAI a limited, non-exclusive, free permission to store, process and display them <Strong>only to provide the service</Strong>: to screen your crop,
          keep your history, let authorised experts review your reports, keep the service secure and meet legal duties. This permission ends when the content is deleted,
          except for records the law requires us to keep.
        </p>
        <p>
          We do not publish your photos or use them to train AI models. If we ever want to, we will ask for your separate permission first.
        </p>
      </>
    ),
  },
  {
    id: 'volunteers-staff',
    title: 'Volunteers, experts and staff',
    content: (
      <>
        <p>People who help run CropAI join by invitation, linked to their own mobile number, and must follow these terms and our privacy policy. They must:</p>
        <LegalList
          items={[
            <>
              <Strong>never</Strong> sign in with a farmer’s phone or OTP, ask a farmer for a code, or act inside a farmer’s account;
            </>,
            'when helping in the field, let the farmer sign in on their own phone and enter their own code;',
            'open only the data their role allows, only for CropAI work, and keep it confidential.',
          ]}
        />
        <p>Their actions are logged. Misuse leads to removal of access and may be reported to the authorities.</p>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Availability, changes and suspension',
    content: (
      <LegalList
        items={[
          'CropAI is currently free to use.',
          'We work to keep it available, but it may be slow or unavailable — for example during maintenance, poor connectivity, or when the AI model is offline. When the model is unavailable the app tells you; it never invents a result.',
          'We may change, add or remove features.',
          'We may suspend or close accounts that break these terms or put others at risk. You can stop using CropAI at any time and ask us to delete your account.',
        ]}
      />
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    content: (
      <>
        <p>
          We build CropAI with care, but it is provided “as is” and “as available”, without a promise that it will always be correct or always be online.
        </p>
        <p>
          To the extent the law allows, CropAI and its team are not responsible for crop loss, lower yield, lost income, or the cost of products or treatments resulting
          from decisions made using the service — which is why we ask you to confirm with an expert before acting.
        </p>
        <p>Nothing in these terms takes away rights you have under Indian law that cannot be excluded, or limits liability that the law does not allow us to limit.</p>
      </>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    content: (
      <p>
        These terms are governed by the laws of India, and courts in India have jurisdiction over any dispute. Please contact us first — most problems can be solved
        quickly.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    content: (
      <p>
        We may update these terms. We will change the “Last updated” date and tell you in the app about important changes before they take effect. If you keep using
        CropAI after that, the updated terms apply.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    content: (
      <>
        <p>
          Questions about these terms: <ContactEmail />
        </p>
        <p>
          For urgent crop problems, contact your KVK or the Kisan Call Centre on{' '}
          <TextLink href="tel:18001801551">1800-180-1551</TextLink> (toll-free) — our inbox is not an emergency service.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <>
      <PageIntro
        eyebrow="Terms & conditions"
        title="The rules, kept simple"
        text="What you can expect from CropAI, what we expect from you, and the limits of an AI crop screening — in plain language."
      />
      <LegalMeta updated={LEGAL_LAST_UPDATED} items={['Website and farmer app', 'Governed by Indian law']} />
      <LegalDocument
        sections={SECTIONS}
        intro={<LegalSummary title="The short version" points={SHORT_VERSION} />}
        aside={
          <LegalHelpCard
            title="How we handle your data"
            text="What we collect, who helps us run CropAI and how to use your rights."
            links={[
              { label: 'Privacy policy', href: '/privacy-policy' },
              { label: 'Your data rights', href: '/data-rights' },
            ]}
          />
        }
      />
    </>
  );
}
