-- CreateTable
CREATE TABLE "RecommendationResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "recommendationIssuanceId" TEXT NOT NULL,
    "responseType" TEXT NOT NULL,
    "respondedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecommendationResponse_recommendationIssuanceId_fkey" FOREIGN KEY ("recommendationIssuanceId") REFERENCES "RecommendationIssuance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecommendationResponse_userId_respondedAt_idx" ON "RecommendationResponse"("userId", "respondedAt");

-- CreateIndex
CREATE INDEX "RecommendationResponse_recommendationIssuanceId_idx" ON "RecommendationResponse"("recommendationIssuanceId");
