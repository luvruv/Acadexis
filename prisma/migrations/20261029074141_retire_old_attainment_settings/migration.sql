/*
  Warnings:

  - You are about to drop the column `level1MinPercent` on the `AttainmentSetting` table. All the data in the column will be lost.
  - You are about to drop the column `level2MinPercent` on the `AttainmentSetting` table. All the data in the column will be lost.
  - You are about to drop the column `level3MinPercent` on the `AttainmentSetting` table. All the data in the column will be lost.
  - You are about to drop the column `thresholdPercent` on the `AttainmentSetting` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AttainmentSetting" DROP COLUMN "level1MinPercent",
DROP COLUMN "level2MinPercent",
DROP COLUMN "level3MinPercent",
DROP COLUMN "thresholdPercent";
UPDATE "AttainmentSetting" SET "confirmed" = false;