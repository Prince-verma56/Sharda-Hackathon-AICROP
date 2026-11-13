-- Mitra preferences per farmer (language, tone, voice, pace, length)
ALTER TABLE "farmer_profiles" ADD COLUMN "mitraSettings" JSONB;
