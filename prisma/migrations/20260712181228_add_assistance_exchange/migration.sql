-- CreateTable
CREATE TABLE "AssistanceExchange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "captureType" TEXT NOT NULL,
    "capturedText" TEXT NOT NULL,
    "assistanceStyle" TEXT NOT NULL,
    "responseContent" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "flags" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssistanceExchange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssistanceExchange_userId_createdAt_idx" ON "AssistanceExchange"("userId", "createdAt");
