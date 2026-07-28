-- CreateTable
CREATE TABLE "MockTestTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "timeLimitMin" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MockTestTemplateQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "MockTestTemplateQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MockTestTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MockTestTemplateQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MockTestAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "score" REAL,
    "correctCount" INTEGER,
    "totalCount" INTEGER,
    CONSTRAINT "MockTestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MockTestAttempt_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MockTestTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuestionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" TEXT NOT NULL,
    "response" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "score" REAL,
    "timeSpentSec" INTEGER,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "curriculumSessionId" TEXT,
    "mockTestAttemptId" TEXT,
    CONSTRAINT "QuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_curriculumSessionId_fkey" FOREIGN KEY ("curriculumSessionId") REFERENCES "CurriculumSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_mockTestAttemptId_fkey" FOREIGN KEY ("mockTestAttemptId") REFERENCES "MockTestAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuestionAttempt" ("attemptedAt", "curriculumSessionId", "id", "isCorrect", "questionId", "response", "score", "selectedOption", "timeSpentSec", "userId") SELECT "attemptedAt", "curriculumSessionId", "id", "isCorrect", "questionId", "response", "score", "selectedOption", "timeSpentSec", "userId" FROM "QuestionAttempt";
DROP TABLE "QuestionAttempt";
ALTER TABLE "new_QuestionAttempt" RENAME TO "QuestionAttempt";
CREATE INDEX "QuestionAttempt_userId_questionId_idx" ON "QuestionAttempt"("userId", "questionId");
CREATE INDEX "QuestionAttempt_userId_curriculumSessionId_idx" ON "QuestionAttempt"("userId", "curriculumSessionId");
CREATE INDEX "QuestionAttempt_userId_mockTestAttemptId_idx" ON "QuestionAttempt"("userId", "mockTestAttemptId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MockTestTemplateQuestion_templateId_order_key" ON "MockTestTemplateQuestion"("templateId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "MockTestTemplateQuestion_templateId_questionId_key" ON "MockTestTemplateQuestion"("templateId", "questionId");

-- CreateIndex
CREATE INDEX "MockTestAttempt_userId_status_idx" ON "MockTestAttempt"("userId", "status");
