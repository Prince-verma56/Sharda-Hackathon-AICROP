import 'server-only';
import { db } from '@/server/db';
import type { ProfileValues } from '@/app/farmer/profile-editor';

export async function loadProfileValues(userId: string): Promise<ProfileValues> {
  const [profile, farm] = await Promise.all([
    db.farmerProfile.findUnique({ where: { userId } }),
    db.farm.findFirst({ where: { ownerId: userId, isPrimary: true } }),
  ]);
  return {
    preferredName: profile?.preferredName ?? '',
    language: profile?.language === 'en' ? 'en' : 'hi',
    district: profile?.district ?? '',
    state: profile?.state ?? '',
    village: profile?.village ?? '',
    mainCrops: profile?.mainCrops ?? [],
    location: farm?.latitude != null && farm.longitude != null ? { latitude: farm.latitude, longitude: farm.longitude, label: farm.locationLabel } : null,
  };
}
