-- CreateTable
CREATE TABLE "RecommendationIssuance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "topic" TEXT,
    "sessionNumber" INTEGER,
    "suggestedAction" TEXT NOT NULL,
    "priorityLabel" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "asOf" DATETIME NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationIssuance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecommendationIssuance_userId_issuedAt_idx" ON "RecommendationIssuance"("userId", "issuedAt");
