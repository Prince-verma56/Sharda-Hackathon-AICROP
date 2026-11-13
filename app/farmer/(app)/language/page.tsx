import { requireFarmer } from '@/server/auth/dal';
import { loadProfileValues } from '@/server/cropai/farmer-profile';
import { ProfileEditor } from '../../profile-editor';

export const metadata = { title: 'Language' };

/** Quick language switch (same editor, language section first). */
export default async function LanguagePage() {
  const farmer = await requireFarmer();
  const values = await loadProfileValues(farmer.userId);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 pt-6 pb-6 lg:pt-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight">भाषा / Language</h1>
      <ProfileEditor initial={values} crops={[]} mode="profile" />
    </div>
  );
}
