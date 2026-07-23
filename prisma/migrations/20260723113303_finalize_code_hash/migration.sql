-- AlterTable
ALTER TABLE "Participant" DROP COLUMN "codeEncrypted",
DROP COLUMN "resendEmailId",
ALTER COLUMN "codeHash" SET NOT NULL,
ALTER COLUMN "codeSalt" SET NOT NULL;
