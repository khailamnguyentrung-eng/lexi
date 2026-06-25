-- CreateTable
CREATE TABLE "ContentUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rawExtractedText" TEXT,
    "sourceLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "normalizedData" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "importedQuestionId" TEXT,
    "importedSessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportItem_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "ContentUpload" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImportItem_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiagnosticTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "grammarScore" REAL NOT NULL,
    "vocabularyScore" REAL NOT NULL,
    "readingScore" REAL NOT NULL,
    "estimatedLevel" TEXT NOT NULL,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiagnosticTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MoodEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MoodEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImportItem_uploadId_reviewStatus_idx" ON "ImportItem"("uploadId", "reviewStatus");

-- CreateIndex
CREATE INDEX "DiagnosticTest_userId_takenAt_idx" ON "DiagnosticTest"("userId", "takenAt");

-- CreateIndex
CREATE INDEX "MoodEntry_userId_createdAt_idx" ON "MoodEntry"("userId", "createdAt");
