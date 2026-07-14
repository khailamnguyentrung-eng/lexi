-- CreateTable
CREATE TABLE "ReviewEngagement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "errorNotebookEntryId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "reviewStageBefore" INTEGER NOT NULL,
    "reviewStageAfter" INTEGER NOT NULL,
    "reachedMastery" BOOLEAN NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewEngagement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReviewEngagement_errorNotebookEntryId_fkey" FOREIGN KEY ("errorNotebookEntryId") REFERENCES "ErrorNotebookEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReviewEngagement_userId_reviewedAt_idx" ON "ReviewEngagement"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "ReviewEngagement_errorNotebookEntryId_idx" ON "ReviewEngagement"("errorNotebookEntryId");
