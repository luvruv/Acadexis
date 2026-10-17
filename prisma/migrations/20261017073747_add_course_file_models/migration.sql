-- CreateEnum
CREATE TYPE "CourseFileStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'LOCKED', 'EXPORTED');

-- CreateEnum
CREATE TYPE "SectionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED');

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseFile" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "coordinatorId" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "batch" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "CourseFileStatus" NOT NULL DEFAULT 'CREATED',
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOutcome" (
    "id" TEXT NOT NULL,
    "courseFileId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CourseOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoPoMapping" (
    "id" TEXT NOT NULL,
    "courseOutcomeId" TEXT NOT NULL,
    "programOutcomeId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "CoPoMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "courseFileId" TEXT NOT NULL,
    "enrollmentNo" TEXT NOT NULL,
    "rollNo" TEXT,
    "name" TEXT NOT NULL,
    "classGroup" TEXT,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseFileSection" (
    "id" TEXT NOT NULL,
    "courseFileId" TEXT NOT NULL,
    "templateSectionId" TEXT,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "source" "SectionSource" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "status" "SectionStatus" NOT NULL DEFAULT 'PENDING',
    "content" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "assigneeId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseFileSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionAssignment" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "requestsChanges" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_programId_code_key" ON "Course"("programId", "code");

-- CreateIndex
CREATE INDEX "CourseFile_coordinatorId_idx" ON "CourseFile"("coordinatorId");

-- CreateIndex
CREATE INDEX "CourseFile_status_idx" ON "CourseFile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CourseFile_courseId_academicYear_semester_revision_key" ON "CourseFile"("courseId", "academicYear", "semester", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOutcome_courseFileId_code_key" ON "CourseOutcome"("courseFileId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CoPoMapping_courseOutcomeId_programOutcomeId_key" ON "CoPoMapping"("courseOutcomeId", "programOutcomeId");

-- CreateIndex
CREATE INDEX "Student_courseFileId_idx" ON "Student"("courseFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_courseFileId_enrollmentNo_key" ON "Student"("courseFileId", "enrollmentNo");

-- CreateIndex
CREATE INDEX "CourseFileSection_assigneeId_idx" ON "CourseFileSection"("assigneeId");

-- CreateIndex
CREATE INDEX "CourseFileSection_courseFileId_status_idx" ON "CourseFileSection"("courseFileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CourseFileSection_courseFileId_number_key" ON "CourseFileSection"("courseFileId", "number");

-- CreateIndex
CREATE INDEX "SectionAssignment_sectionId_idx" ON "SectionAssignment"("sectionId");

-- CreateIndex
CREATE INDEX "SectionAssignment_assigneeId_idx" ON "SectionAssignment"("assigneeId");

-- CreateIndex
CREATE INDEX "ReviewComment_sectionId_idx" ON "ReviewComment"("sectionId");

-- CreateIndex
CREATE INDEX "Attachment_sectionId_idx" ON "Attachment"("sectionId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFile" ADD CONSTRAINT "CourseFile_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFile" ADD CONSTRAINT "CourseFile_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFile" ADD CONSTRAINT "CourseFile_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFile" ADD CONSTRAINT "CourseFile_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOutcome" ADD CONSTRAINT "CourseOutcome_courseFileId_fkey" FOREIGN KEY ("courseFileId") REFERENCES "CourseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoPoMapping" ADD CONSTRAINT "CoPoMapping_courseOutcomeId_fkey" FOREIGN KEY ("courseOutcomeId") REFERENCES "CourseOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoPoMapping" ADD CONSTRAINT "CoPoMapping_programOutcomeId_fkey" FOREIGN KEY ("programOutcomeId") REFERENCES "ProgramOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_courseFileId_fkey" FOREIGN KEY ("courseFileId") REFERENCES "CourseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFileSection" ADD CONSTRAINT "CourseFileSection_courseFileId_fkey" FOREIGN KEY ("courseFileId") REFERENCES "CourseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFileSection" ADD CONSTRAINT "CourseFileSection_templateSectionId_fkey" FOREIGN KEY ("templateSectionId") REFERENCES "TemplateSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFileSection" ADD CONSTRAINT "CourseFileSection_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionAssignment" ADD CONSTRAINT "SectionAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseFileSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionAssignment" ADD CONSTRAINT "SectionAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionAssignment" ADD CONSTRAINT "SectionAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseFileSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseFileSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
