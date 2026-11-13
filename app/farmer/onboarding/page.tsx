import { Accent, PageIntro } from '@/components/app/page-intro';
import { Logo } from '@/components/marketing/home/brand';
import { requireFarmer } from '@/server/auth/dal';
import { getCropImages } from '@/server/cropai/crop-images';
import { loadProfileValues } from '@/server/cropai/farmer-profile';
import { tryGetTaxonomy } from '@/server/cropai/taxonomy';
import { ProfileEditor } from '../profile-editor';

export const metadata = { title: 'Welcome' };

export default async function OnboardingPage() {
  const farmer = await requireFarmer();
  const [values, taxonomy, cropImages] = await Promise.all([loadProfileValues(farmer.userId), tryGetTaxonomy(), getCropImages()]);
  const lang = values.language === 'en' ? 'en' : 'hi';
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-6 pb-6 sm:px-6 sm:pt-10">
      <Logo className="text-[1.2rem]" />
      <PageIntro
        lang={lang}
        eyebrow={lang === 'hi' ? 'शुरुआत · 1 मिनट' : 'Getting started · 1 minute'}
        title={
          lang === 'hi' ? (
            <>
              <Accent>स्वागत</Accent> है
            </>
          ) : (
            <>
              <Accent>Welcome</Accent> to CropAI
            </>
          )
        }
        description={lang === 'hi' ? 'कुछ आसान सवाल — सब वैकल्पिक हैं। आप इन्हें बाद में प्रोफ़ाइल में बदल सकते हैं।' : 'A few quick questions — all optional. You can change them later in your profile.'}
      />
      <ProfileEditor initial={values} crops={taxonomy?.crops.map((c) => c.id) ?? []} cropImages={cropImages} mode="onboarding" />
    </div>
  );
}
