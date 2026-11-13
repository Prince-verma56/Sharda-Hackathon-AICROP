import { Accent, PageIntro } from '@/components/app/page-intro';
import { requireFarmer } from '@/server/auth/dal';
import { loadProfileValues } from '@/server/cropai/farmer-profile';
import { ProfileEditor } from '../../profile-editor';

export const metadata = { title: 'Language' };

/** Quick language switch (same editor without the crop list). */
export default async function LanguagePage() {
  const farmer = await requireFarmer();
  const values = await loadProfileValues(farmer.userId);
  const lang = values.language === 'en' ? 'en' : 'hi';
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-6 pb-8 sm:px-6 lg:gap-8 lg:pt-10">
      <PageIntro
        lang={lang}
        eyebrow="भाषा · Language"
        title={
          lang === 'hi' ? (
            <>
              अपनी <Accent>भाषा</Accent> चुनें
            </>
          ) : (
            <>
              Choose your <Accent>language</Accent>
            </>
          )
        }
      />
      <ProfileEditor initial={values} crops={[]} mode="profile" />
    </div>
  );
}
