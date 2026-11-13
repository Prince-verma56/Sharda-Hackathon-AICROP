-- Clerk phone-only auth: database-owned roles, invitations, volunteer and admin profiles.

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('FARMER', 'VOLUNTEER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AdminLevel" AS ENUM ('ADMIN', 'AGRONOMIST', 'REVIEWER', 'ANALYST');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VolunteerVerification" AS ENUM ('PENDING', 'VERIFIED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AppRole" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_invitations" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "AppRole" NOT NULL,
    "adminLevel" "AdminLevel",
    "serviceArea" TEXT,
    "invitedById" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_profiles" (
    "userId" TEXT NOT NULL,
    "serviceArea" TEXT,
    "district" TEXT,
    "state" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verificationStatus" "VolunteerVerification" NOT NULL DEFAULT 'PENDING',
    "trainingStatus" "TrainingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "profileCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volunteer_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "admin_profiles" (
    "userId" TEXT NOT NULL,
    "adminLevel" "AdminLevel" NOT NULL DEFAULT 'ADMIN',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "user_roles_role_idx" ON "user_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_role_key" ON "user_roles"("userId", "role");

-- CreateIndex
CREATE INDEX "role_invitations_phone_status_idx" ON "role_invitations"("phone", "status");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_invitations" ADD CONSTRAINT "role_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_profiles" ADD CONSTRAINT "volunteer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: preserve existing access before the old tables are dropped.
INSERT INTO "user_roles" ("id", "userId", "role", "assignedAt")
SELECT 'ur_' || md5(random()::text || u."id"), u."id", 'FARMER'::"AppRole", now()
FROM "users" u WHERE u."kind" = 'FARMER';

INSERT INTO "user_roles" ("id", "userId", "role", "assignedAt")
SELECT 'ur_' || md5(random()::text || s."userId"), s."userId",
       (CASE WHEN s."role"::text = 'SUPER_ADMIN' THEN 'SUPER_ADMIN' ELSE 'ADMIN' END)::"AppRole", now()
FROM "staff_profiles" s;

INSERT INTO "admin_profiles" ("userId", "adminLevel", "permissions", "createdAt", "updatedAt")
SELECT s."userId",
       (CASE WHEN s."role"::text IN ('AGRONOMIST', 'REVIEWER', 'ANALYST') THEN s."role"::text ELSE 'ADMIN' END)::"AdminLevel",
       ARRAY[]::text[], now(), now()
FROM "staff_profiles" s;

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "staff_invites" DROP CONSTRAINT "staff_invites_invitedById_fkey";

-- DropForeignKey
ALTER TABLE "staff_profiles" DROP CONSTRAINT "staff_profiles_userId_fkey";

-- DropIndex
DROP INDEX "users_kind_createdAt_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "kind",
ADD COLUMN     "activeWorkspace" TEXT;

-- DropTable
DROP TABLE "sessions";

-- DropTable
DROP TABLE "staff_invites";

-- DropTable
DROP TABLE "staff_profiles";

-- DropEnum
DROP TYPE "StaffRole";

-- DropEnum
DROP TYPE "UserKind";
