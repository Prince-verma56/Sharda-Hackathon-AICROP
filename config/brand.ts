/** Brand is not final — everything user-facing reads it from here (env-overridable). */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'CropAI',
  assistantName: process.env.NEXT_PUBLIC_ASSISTANT_NAME || 'Mitra',
  tagline: 'Smarter Farming. Greener Tomorrow.',
} as const;
