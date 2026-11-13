-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "language" TEXT,
ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "persisted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "summarizedMessageId" TEXT,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "summaryVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "farmer_profiles" ADD COLUMN     "chatHistoryConsentAt" TIMESTAMP(3),
ADD COLUMN     "consentPolicyVersion" TEXT,
ADD COLUMN     "voiceTranscriptConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "modality" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN     "model" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'complete',
ADD COLUMN     "turnId" TEXT;

-- CreateTable
CREATE TABLE "conversation_diagnoses" (
    "conversationId" TEXT NOT NULL,
    "diagnosisId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_diagnoses_pkey" PRIMARY KEY ("conversationId","diagnosisId")
);

-- CreateIndex
CREATE INDEX "conversation_diagnoses_diagnosisId_idx" ON "conversation_diagnoses"("diagnosisId");

-- CreateIndex
CREATE INDEX "conversations_userId_lastMessageAt_idx" ON "conversations"("userId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_turnId_key" ON "messages"("turnId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "conversation_diagnoses" ADD CONSTRAINT "conversation_diagnoses_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_diagnoses" ADD CONSTRAINT "conversation_diagnoses_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

