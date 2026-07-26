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
    "programCurriculumId" TEXT,
    CONSTRAINT "QuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_curriculumSessionId_fkey" FOREIGN KEY ("curriculumSessionId") REFERENCES "CurriculumSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_mockTestAttemptId_fkey" FOREIGN KEY ("mockTestAttemptId") REFERENCES "MockTestAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_programCurriculumId_fkey" FOREIGN KEY ("programCurriculumId") REFERENCES "ProgramCurriculum" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuestionAttempt" ("attemptedAt", "curriculumSessionId", "id", "isCorrect", "mockTestAttemptId", "questionId", "response", "score", "selectedOption", "timeSpentSec", "userId") SELECT "attemptedAt", "curriculumSessionId", "id", "isCorrect", "mockTestAttemptId", "questionId", "response", "score", "selectedOption", "timeSpentSec", "userId" FROM "QuestionAttempt";
DROP TABLE "QuestionAttempt";
ALTER TABLE "new_QuestionAttempt" RENAME TO "QuestionAttempt";
CREATE INDEX "QuestionAttempt_userId_questionId_idx" ON "QuestionAttempt"("userId", "questionId");
CREATE INDEX "QuestionAttempt_userId_curriculumSessionId_idx" ON "QuestionAttempt"("userId", "curriculumSessionId");
CREATE INDEX "QuestionAttempt_userId_mockTestAttemptId_idx" ON "QuestionAttempt"("userId", "mockTestAttemptId");
CREATE INDEX "QuestionAttempt_userId_programCurriculumId_idx" ON "QuestionAttempt"("userId", "programCurriculumId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
