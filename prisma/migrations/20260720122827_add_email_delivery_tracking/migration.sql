/*
  Warnings:

  - Made the column `email` on table `Participant` required. Rows with NULL email are deleted first.

*/
-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'BOUNCED', 'FAILED');

-- DeleteNullEmailParticipants: remove legacy creator rows that pre-date the email requirement
DELETE FROM "Participant" WHERE email IS NULL;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "emailDeliveryStatus" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "resendEmailId" TEXT,
ALTER COLUMN "email" SET NOT NULL;
