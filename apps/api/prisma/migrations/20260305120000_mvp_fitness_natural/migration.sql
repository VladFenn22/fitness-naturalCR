/*
  Warnings:

  - Se elimina la tabla `WeeklyCheckIn` (los check-ins semanales quedan fuera del MVP).
*/

-- DropTable
DROP TABLE IF EXISTS "WeeklyCheckIn";

-- AlterTable
ALTER TABLE "Coach" ADD COLUMN     "email" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ClientProfile" ADD COLUMN     "nombre" TEXT,
ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE INDEX "ClientProfile_coachId_idx" ON "ClientProfile"("coachId");
