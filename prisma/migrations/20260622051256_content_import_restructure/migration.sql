/*
  Warnings:

  - You are about to drop the `ContentUpload` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ImportItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ContentUpload";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ImportItem";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ContentSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentSourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rawExtractedText" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportJob_contentSourceId_fkey" FOREIGN KEY ("contentSourceId") REFERENCES "ContentSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractedQuestionDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "normalizedData" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "importedQuestionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExtractedQuestionDraft_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExtractedQuestionDraft_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExtractedQuestionDraft_importJobId_reviewStatus_idx" ON "ExtractedQuestionDraft"("importJobId", "reviewStatus");
