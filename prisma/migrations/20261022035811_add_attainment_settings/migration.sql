-- CreateTable
CREATE TABLE "AttainmentSetting" (
    "courseFileId" TEXT NOT NULL,
    "thresholdPercent" DECIMAL(5,2) NOT NULL,
    "level1MinPercent" DECIMAL(5,2) NOT NULL,
    "level2MinPercent" DECIMAL(5,2) NOT NULL,
    "level3MinPercent" DECIMAL(5,2) NOT NULL,
    "absentAsZero" BOOLEAN NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttainmentSetting_pkey" PRIMARY KEY ("courseFileId")
);

-- AddForeignKey
ALTER TABLE "AttainmentSetting" ADD CONSTRAINT "AttainmentSetting_courseFileId_fkey" FOREIGN KEY ("courseFileId") REFERENCES "CourseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
