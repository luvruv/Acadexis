-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "courseFileId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "docxPath" TEXT NOT NULL,
    "docxBytes" INTEGER NOT NULL,
    "docxSha256" TEXT NOT NULL,
    "pdfPath" TEXT NOT NULL,
    "pdfBytes" INTEGER NOT NULL,
    "pdfSha256" TEXT NOT NULL,
    "annexureCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedDocument_documentId_key" ON "GeneratedDocument"("documentId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_courseFileId_idx" ON "GeneratedDocument"("courseFileId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedDocument_courseFileId_revision_key" ON "GeneratedDocument"("courseFileId", "revision");

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_courseFileId_fkey" FOREIGN KEY ("courseFileId") REFERENCES "CourseFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
