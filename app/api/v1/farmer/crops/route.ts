/**
 * GET /api/v1/farmer/crops — crop picker data for the mobile app.
 *   crops     the crops the LOADED AgriSmart checkpoint supports (from the inference service, never a
 *             hard-coded list) with English + Hindi names and the crop photo (public/images/crops)
 *   mine      the farmer's main crops (profile)
 *   popular   crops checked most often on the platform (real counts), excluding `mine`
 *   samples   licensed sample leaf photos (PlantDoc, CC BY 4.0) to try the real model
 *   fieldDetails  the optional field-detail questions (same options as the web scan step)
 *   autoCrop  true: "I don't know the crop" is supported (model predicts the crop too)
 */
import { CROP_DISPLAY, cropName } from '@/lib/crops';
import { FIELD_LABELS, FIELD_OPTIONS } from '@/lib/cropai/field-context';
import { getCurrentFarmer } from '@/server/auth/dal';
import { getCropImages } from '@/server/cropai/crop-images';
import { listSamples } from '@/server/cropai/samples';
import { tryGetTaxonomy } from '@/server/cropai/taxonomy';
import { db } from '@/server/db';
import { fail, ok } from '@/server/http/respond';

export async function GET() {
  const farmer = await getCurrentFarmer();
  if (!farmer) return fail('UNAUTHORIZED', 401, 'Please sign in again.');
  const taxonomy = await tryGetTaxonomy();
  if (!taxonomy) return fail('INFERENCE_OFFLINE', 503, 'The crop doctor is offline right now. Please try again later.');

  const ids = taxonomy.crops.map((c) => c.id);
  const [cropImages, profile, counts, samples] = await Promise.all([
    getCropImages(),
    db.farmerProfile.findUnique({ where: { userId: farmer.userId }, select: { mainCrops: true } }),
    db.diagnosis.groupBy({ by: ['predictedCrop'], _count: { _all: true }, orderBy: { _count: { predictedCrop: 'desc' } }, take: 12 }),
    listSamples(ids),
  ]);
  const mine = (profile?.mainCrops ?? []).filter((id) => ids.includes(id));
  const popular = counts.map((c) => c.predictedCrop).filter((id) => ids.includes(id) && !mine.includes(id)).slice(0, 8);

  return ok({
    modelVersion: taxonomy.modelVersion,
    cropCount: taxonomy.cropCount,
    classCount: taxonomy.classCount,
    autoCrop: true,
    crops: taxonomy.crops
      .map((c) => ({
        id: c.id,
        name: { en: cropName(c.id, 'en'), hi: CROP_DISPLAY[c.id]?.hi ?? cropName(c.id, 'en') },
        imageUrl: cropImages[c.id] ?? null,
        classCount: c.classCount,
        conditions: c.classes.map((k) => ({ label: k.label, name: k.name, isHealthy: k.isHealthy })),
      }))
      .sort((a, b) => a.name.en.localeCompare(b.name.en)),
    mine,
    popular,
    samples: samples.slice(0, 12).map((s) => ({ file: s.file, crop: s.crop, condition: s.condition, url: s.url, credit: 'PlantDoc (Singh et al. 2020), CC BY 4.0' })),
    fieldDetails: {
      labels: FIELD_LABELS,
      options: Object.fromEntries(Object.entries(FIELD_OPTIONS).map(([key, values]) => [key, Object.entries(values).map(([id, label]) => ({ id, ...label }))])),
      multiple: ['parts'],
    },
  });
}
