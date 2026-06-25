-- AlterTable
ALTER TABLE "UserSessionProgress" ADD COLUMN "startedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuestionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSpentSec" INTEGER,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "curriculumSessionId" TEXT,
    CONSTRAINT "QuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_curriculumSessionId_fkey" FOREIGN KEY ("curriculumSessionId") REFERENCES "CurriculumSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuestionAttempt" ("attemptedAt", "id", "isCorrect", "questionId", "selectedOption", "timeSpentSec", "userId") SELECT "attemptedAt", "id", "isCorrect", "questionId", "selectedOption", "timeSpentSec", "userId" FROM "QuestionAttempt";
DROP TABLE "QuestionAttempt";
ALTER TABLE "new_QuestionAttempt" RENAME TO "QuestionAttempt";
CREATE INDEX "QuestionAttempt_userId_questionId_idx" ON "QuestionAttempt"("userId", "questionId");
CREATE INDEX "QuestionAttempt_userId_curriculumSessionId_idx" ON "QuestionAttempt"("userId", "curriculumSessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
