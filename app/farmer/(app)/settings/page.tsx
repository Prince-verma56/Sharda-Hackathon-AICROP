import { Accent, PageIntro } from '@/components/app/page-intro';
import { getMitraSettings } from '@/ai/settings/mitra-settings';
import { requireFarmer } from '@/server/auth/dal';
import { MitraSettingsForm } from './mitra-settings-form';

export const metadata = { title: 'Mitra settings' };

/** The farmer's own Mitra settings (voice + chat). Unset choices follow the admin defaults. */
export default async function MitraSettingsPage() {
  const farmer = await requireFarmer();
  const lang = farmer.language === 'hi' ? 'hi' : 'en';
  const { effective, overrides, defaults } = await getMitraSettings(farmer.userId);
  const { extraInstructions: _extra, ...defaultChoices } = defaults;
  void _extra;
  return (
    <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-6 px-4 pt-6 pb-8 sm:px-6 lg:gap-8 lg:px-8 lg:pt-10">
      <PageIntro
        lang={lang}
        eyebrow={lang === 'hi' ? 'मित्र सेटिंग्स' : 'Mitra settings'}
        title={
          lang === 'hi' ? (
            <>
              अपना <Accent>मित्र</Accent> चुनें
            </>
          ) : (
            <>
              Make <Accent>Mitra</Accent> yours
            </>
          )
        }
        description={
          lang === 'hi'
            ? 'भाषा, स्वभाव, आवाज़ और जवाब की लंबाई — बोलकर और लिखकर, दोनों बातचीत में लागू।'
            : 'Language, tone, voice and answer length — used for both voice calls and chat.'
        }
      />
      <MitraSettingsForm lang={lang} initial={effective} overrides={overrides} defaults={defaultChoices} />
    </div>
  );
}
