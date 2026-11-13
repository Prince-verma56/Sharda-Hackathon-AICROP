import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { maskPhone } from '@/server/auth/phone';
import { requireFarmer } from '@/server/auth/dal';
import { loadProfileValues } from '@/server/cropai/farmer-profile';
import { tryGetTaxonomy } from '@/server/cropai/taxonomy';
import { ProfileEditor } from '../../profile-editor';
import { AccountControls } from './account-controls';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const farmer = await requireFarmer();
  const [values, taxonomy] = await Promise.all([loadProfileValues(farmer.userId), tryGetTaxonomy()]);
  const hi = values.language !== 'en';
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 pt-6 pb-6 lg:max-w-3xl lg:px-8 lg:pt-10">
      <header>
        <h1 className="text-[1.75rem] font-semibold tracking-tight">{hi ? 'प्रोफ़ाइल' : 'Profile'}</h1>
        <p className="text-sm text-muted-foreground">{maskPhone(farmer.phone)}</p>
      </header>
      <ProfileEditor initial={values} crops={taxonomy?.crops.map((c) => c.id) ?? []} mode="profile" />
      <Card className="rounded-[24px]">
        <CardHeader><CardTitle>{hi ? 'खाता' : 'Account'}</CardTitle></CardHeader>
        <CardContent>
          <AccountControls lang={values.language} />
        </CardContent>
      </Card>
    </div>
  );
}
