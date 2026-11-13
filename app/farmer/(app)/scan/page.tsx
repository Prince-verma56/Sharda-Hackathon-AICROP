import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { requireFarmer } from '@/server/auth/dal';
import { getCropImages } from '@/server/cropai/crop-images';
import { listSamples } from '@/server/cropai/samples';
import { tryGetTaxonomy } from '@/server/cropai/taxonomy';
import { db } from '@/server/db';
import { ScanFlow } from './scan-flow';

export const metadata = { title: 'Check my crop' };

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ crop?: string }> }) {
  const farmer = await requireFarmer();
  const [taxonomy, profile, params, farm] = await Promise.all([
    tryGetTaxonomy(),
    db.farmerProfile.findUnique({ where: { userId: farmer.userId }, select: { mainCrops: true, photoConsentAt: true } }),
    searchParams,
    db.farm.findFirst({ where: { ownerId: farmer.userId, latitude: { not: null } }, select: { id: true } }),
  ]);
  if (!taxonomy) {
    const hi = farmer.language !== 'en';
    return (
      <div className="px-5 pt-8">
        <Alert variant="destructive">
          <AlertTitle>{hi ? 'फसल डॉक्टर अभी उपलब्ध नहीं है' : 'The crop doctor is unavailable'}</AlertTitle>
          <AlertDescription>{hi ? 'कृपया थोड़ी देर बाद कोशिश करें।' : 'Please try again in a little while.'}</AlertDescription>
        </Alert>
      </div>
    );
  }
  const crops = taxonomy.crops.map((c) => c.id);
  const [samples, cropImages] = await Promise.all([listSamples(crops), getCropImages()]);
  return (
    <ScanFlow
      crops={crops}
      mainCrops={profile?.mainCrops ?? []}
      lang={farmer.language}
      hasConsent={Boolean(profile?.photoConsentAt)}
      initialCrop={params.crop ?? null}
      samples={samples}
      cropImages={cropImages}
      farmHasLocation={Boolean(farm)}
    />
  );
}
