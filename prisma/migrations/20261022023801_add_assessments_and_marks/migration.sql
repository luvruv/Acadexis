-- CreateTable
CREATE TABLE "AssessmentComponent" (
    "id" TEXT NOT NULL,
    "courseFileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxMarks" DECIMAL(7,2) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "AssessmentComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentCourseOutcome" (
    "componentId" TEXT NOT NULL,
    "courseOutcomeId" TEXT NOT NULL,

    CONSTRAINT "ComponentCourseOutcome_pkey" PRIMARY KEY ("componentId","courseOutcomeId")
);

-- CreateTable
CREATE TABLE "Mark" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marks" DECIMAL(7,2),
    "absent" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentComponent_courseFileId_idx" ON "AssessmentComponent"("courseFileId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentComponent_courseFileId_name_key" ON "AssessmentComponent"("courseFileId", "name");

-- CreateIndex
CREATE INDEX "ComponentCourseOutcome_courseOutcomeId_idx" ON "ComponentCourseOutcome"("courseOutcomeId");

-- CreateIndex
CREATE INDEX "Mark_studentId_idx" ON "Mark"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Mark_componentId_studentId_key" ON "Mark"("componentId", "studentId");

-- AddForeignKey
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_courseFileId_fkey" FOREIGN KEY ("courseFileId") REFERENCES "CourseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentCourseOutcome" ADD CONSTRAINT "ComponentCourseOutcome_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "AssessmentComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentCourseOutcome" ADD CONSTRAINT "ComponentCourseOutcome_courseOutcomeId_fkey" FOREIGN KEY ("courseOutcomeId") REFERENCES "CourseOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "AssessmentComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
