import { requireFarmer } from '@/server/auth/dal';
import { loadProfileValues } from '@/server/cropai/farmer-profile';
import { tryGetTaxonomy } from '@/server/cropai/taxonomy';
import { ProfileEditor } from '../profile-editor';

export const metadata = { title: 'Welcome' };

export default async function OnboardingPage() {
  const farmer = await requireFarmer();
  const [values, taxonomy] = await Promise.all([loadProfileValues(farmer.userId), tryGetTaxonomy()]);
  const hi = values.language !== 'en';
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pt-8 pb-6">
      <header>
        <span className="text-4xl" aria-hidden>🌾</span>
        <h1 className="mt-3 text-[1.75rem] leading-tight font-semibold tracking-tight">{hi ? 'स्वागत है!' : 'Welcome!'}</h1>
        <p className="mt-1 text-base text-muted-foreground">{hi ? 'कुछ आसान सवाल — सब वैकल्पिक हैं।' : 'A few quick questions — all optional.'}</p>
      </header>
      <ProfileEditor initial={values} crops={taxonomy?.crops.map((c) => c.id) ?? []} mode="onboarding" />
    </div>
  );
}
