-- AlterTable
ALTER TABLE "AttainmentSetting" ADD COLUMN     "courseLevel2MinPercent" DECIMAL(5,2) NOT NULL DEFAULT 65,
ADD COLUMN     "courseLevel3MinPercent" DECIMAL(5,2) NOT NULL DEFAULT 70,
ADD COLUMN     "studentLevel2Min" DECIMAL(5,4) NOT NULL DEFAULT 0.4500,
ADD COLUMN     "studentLevel3Min" DECIMAL(5,4) NOT NULL DEFAULT 0.5000;

-- AlterTable
ALTER TABLE "ComponentCourseOutcome" ADD COLUMN     "weight" DECIMAL(6,4);

-- AlterTable
ALTER TABLE "CourseOutcome" ADD COLUMN     "attainmentWeight" DECIMAL(6,4);
