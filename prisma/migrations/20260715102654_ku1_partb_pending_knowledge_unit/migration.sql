-- CreateTable
CREATE TABLE "SourceRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentSourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rawExtractedText" TEXT,
    "chunks" TEXT,
    "chunkCount" INTEGER,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceRead_contentSourceId_fkey" FOREIGN KEY ("contentSourceId") REFERENCES "ContentSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxonomyJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceReadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxonomyJob_sourceReadId_fkey" FOREIGN KEY ("sourceReadId") REFERENCES "SourceRead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingKnowledgeUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentSourceId" TEXT NOT NULL,
    "taxonomyJobId" TEXT,
    "proposedTopic" TEXT NOT NULL,
    "proposedLabel" TEXT NOT NULL,
    "evidenceQuote" TEXT NOT NULL,
    "evidenceLocation" TEXT,
    "aiConfidence" REAL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "resolvedUnitId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingKnowledgeUnit_contentSourceId_fkey" FOREIGN KEY ("contentSourceId") REFERENCES "ContentSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PendingKnowledgeUnit_taxonomyJobId_fkey" FOREIGN KEY ("taxonomyJobId") REFERENCES "TaxonomyJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PendingKnowledgeUnit_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PendingKnowledgeUnit_resolvedUnitId_fkey" FOREIGN KEY ("resolvedUnitId") REFERENCES "KnowledgeUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PendingKnowledgeUnit_proposedTopic_idx" ON "PendingKnowledgeUnit"("proposedTopic");

-- CreateIndex
CREATE INDEX "PendingKnowledgeUnit_reviewStatus_idx" ON "PendingKnowledgeUnit"("reviewStatus");
