
-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VolunteerActivityKind" AS ENUM ('FIELD_VISIT', 'AWARENESS_SESSION', 'FARMER_ASSISTANCE', 'TRAINING');

-- CreateEnum
CREATE TYPE "ContentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "role_invitations" ADD COLUMN     "district" TEXT,
ADD COLUMN     "inviteeName" TEXT,
ADD COLUMN     "tokenHash" TEXT,
ADD COLUMN     "village" TEXT;

-- AlterTable
ALTER TABLE "volunteer_profiles" ADD COLUMN     "availability" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "preferredLanguage" TEXT,
ADD COLUMN     "village" TEXT;

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "region" TEXT,
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_activities" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "campaignId" TEXT,
    "kind" "VolunteerActivityKind" NOT NULL,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "village" TEXT,
    "farmersReached" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volunteer_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_videos" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT,
    "crop" TEXT,
    "storageKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "status" "ContentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volunteer_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_status_createdAt_idx" ON "campaigns"("status", "createdAt");

-- CreateIndex
CREATE INDEX "volunteer_activities_volunteerId_occurredOn_idx" ON "volunteer_activities"("volunteerId", "occurredOn");

-- CreateIndex
CREATE INDEX "volunteer_activities_campaignId_idx" ON "volunteer_activities"("campaignId");

-- CreateIndex
CREATE INDEX "volunteer_videos_status_createdAt_idx" ON "volunteer_videos"("status", "createdAt");

-- CreateIndex
CREATE INDEX "volunteer_videos_volunteerId_createdAt_idx" ON "volunteer_videos"("volunteerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "role_invitations_tokenHash_key" ON "role_invitations"("tokenHash");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_activities" ADD CONSTRAINT "volunteer_activities_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_activities" ADD CONSTRAINT "volunteer_activities_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_videos" ADD CONSTRAINT "volunteer_videos_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_videos" ADD CONSTRAINT "volunteer_videos_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

