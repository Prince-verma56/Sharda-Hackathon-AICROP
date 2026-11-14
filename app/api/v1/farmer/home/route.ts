/**
 * GET /api/v1/farmer/home — what the farmer home screen shows (same data as app/farmer/(app)/page.tsx):
 * greeting name, latest check, number of checks, unread notifications, admin notice, the farmer's
 * crops, live weather for the saved farm location (Open-Meteo; context only) and approved videos.
 */
import { cropName } from '@/lib/crops';
import { getCurrentFarmer } from '@/server/auth/dal';
import { getCropImages } from '@/server/cropai/crop-images';
import { getSettings } from '@/server/cropai/settings';
import { fetchWeather } from '@/server/cropai/weather';
import { db } from '@/server/db';
import { fail, ok } from '@/server/http/respond';

export async function GET() {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const lang = farmer.language === 'hi' ? 'hi' : 'en';
  const [latest, farm, unread, checks, settings, profile, cropImages, videos] = await Promise.all([
    db.diagnosis.findFirst({ where: { farmerId: farmer.userId }, orderBy: { createdAt: 'desc' } }),
    db.farm.findFirst({ where: { ownerId: farmer.userId, isPrimary: true } }),
    db.notification.count({ where: { userId: farmer.userId, readAt: null } }),
    db.diagnosis.count({ where: { farmerId: farmer.userId } }),
    getSettings(),
    db.farmerProfile.findUnique({ where: { userId: farmer.userId }, select: { mainCrops: true } }),
    getCropImages(),
    db.volunteerVideo.findMany({ where: { status: 'APPROVED' }, orderBy: { reviewedAt: 'desc' }, take: 3, select: { id: true, title: true, language: true, thumbnailKey: true } }),
  ]);
  const hasLocation = farm?.latitude != null && farm.longitude != null;
  const weather = hasLocation ? await fetchWeather(farm!.latitude!, farm!.longitude!).catch(() => null) : null;

  return ok({
    language: lang,
    preferredName: farmer.preferredName,
    onboarded: farmer.onboarded,
    notice: settings.farmer_notice || null,
    unreadNotifications: unread,
    checks,
    latest: latest
      ? {
          id: latest.id,
          createdAt: latest.createdAt.toISOString(),
          crop: { id: latest.predictedCrop, name: cropName(latest.predictedCrop, lang), imageUrl: cropImages[latest.predictedCrop] ?? null },
          condition: latest.predictedCondition,
          isHealthy: latest.isHealthy,
          score: latest.confidence,
          thumbnailUrl: latest.imageKey ? `/api/v1/images/diagnoses/${latest.id}` : null,
        }
      : null,
    crops: (profile?.mainCrops ?? []).map((id) => ({ id, name: cropName(id, lang), imageUrl: cropImages[id] ?? null })),
    farm: farm ? { label: farm.locationLabel, hasLocation } : null,
    weather: weather
      ? {
          provider: weather.provider,
          observedAt: weather.observedAt,
          timezone: weather.timezone,
          temperatureC: weather.temperatureC,
          humidityPct: weather.humidityPct,
          rainLast24hMm: weather.rainLast24hMm,
          forecast: weather.forecast.slice(0, 5).map((f) => ({ date: f.date, maxC: f.maxC, minC: f.minC, rainMm: f.rainMm, rainChancePct: f.rainChancePct })),
          note: lang === 'hi' ? 'सिर्फ़ मौसम की जानकारी, बीमारी का अनुमान नहीं' : 'Weather context only, not a disease forecast',
        }
      : null,
    weatherStatus: weather ? 'ok' : hasLocation ? 'unavailable' : 'no_location',
    videos: videos.map((v) => ({ id: v.id, title: v.title, language: v.language, thumbnailUrl: v.thumbnailKey ? `/api/v1/videos/${v.id}/thumbnail` : null, streamUrl: `/api/v1/videos/${v.id}` })),
  });
}
