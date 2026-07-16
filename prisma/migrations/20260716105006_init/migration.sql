-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('creator', 'contact');

-- CreateTable
CREATE TABLE "Brocode" (
    "id" TEXT NOT NULL,
    "managementToken" TEXT NOT NULL,
    "unlockToken" TEXT NOT NULL,
    "assetObjectKey" TEXT NOT NULL,
    "assetContentType" TEXT NOT NULL,
    "assetKind" "AssetKind" NOT NULL,
    "title" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brocode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "brocodeId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "codeEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnlockSession" (
    "id" TEXT NOT NULL,
    "brocodeId" TEXT NOT NULL,
    "matchedParticipantIds" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "viewToken" TEXT,
    "viewTokenExpiresAt" TIMESTAMP(3),
    "viewTokenUsedAt" TIMESTAMP(3),

    CONSTRAINT "UnlockSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brocode_managementToken_key" ON "Brocode"("managementToken");

-- CreateIndex
CREATE UNIQUE INDEX "Brocode_unlockToken_key" ON "Brocode"("unlockToken");

-- CreateIndex
CREATE UNIQUE INDEX "UnlockSession_viewToken_key" ON "UnlockSession"("viewToken");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_brocodeId_fkey" FOREIGN KEY ("brocodeId") REFERENCES "Brocode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnlockSession" ADD CONSTRAINT "UnlockSession_brocodeId_fkey" FOREIGN KEY ("brocodeId") REFERENCES "Brocode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
