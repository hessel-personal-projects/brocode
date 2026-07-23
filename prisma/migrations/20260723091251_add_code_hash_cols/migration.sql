-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "codeHash" TEXT,
ADD COLUMN     "codeSalt" TEXT,
ADD COLUMN     "emailMessageId" TEXT;
