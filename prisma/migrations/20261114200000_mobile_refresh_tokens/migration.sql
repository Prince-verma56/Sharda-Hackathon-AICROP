-- Mobile (Flutter) sessions: short-lived access token + rotating refresh token on the SAME
-- sessions table used by the web (no second authentication store). All columns are nullable,
-- so existing web and mobile sessions keep working unchanged.

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "refreshTokenHash" TEXT,
ADD COLUMN "previousRefreshHash" TEXT,
ADD COLUMN "refreshExpiresAt" TIMESTAMP(3),
ADD COLUMN "rotatedAt" TIMESTAMP(3),
ADD COLUMN "deviceId" TEXT,
ADD COLUMN "deviceName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "sessions_previousRefreshHash_idx" ON "sessions"("previousRefreshHash");
