-- DropIndex
DROP INDEX "CurriculumSession_sessionNumber_key";

-- DropIndex
DROP INDEX "UserSessionProgress_userId_curriculumSessionId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CurriculumPhase";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CurriculumSession";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "KnowledgeUnitOnSession";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "UserSessionProgress";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionCode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "topic" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "responseFormat" TEXT NOT NULL DEFAULT 'SINGLE_CHOICE',
    "payload" TEXT,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctOption" TEXT NOT NULL,
    "explanationVi" TEXT NOT NULL,
    "commonMistake" TEXT,
    "learningObjective" TEXT,
    "source" TEXT NOT NULL,
    "sourceExam" TEXT,
    "tags" TEXT,
    "passageId" TEXT,
    "knowledgeUnitId" TEXT,
    "generatedViaJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_knowledgeUnitId_fkey" FOREIGN KEY ("knowledgeUnitId") REFERENCES "KnowledgeUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_generatedViaJobId_fkey" FOREIGN KEY ("generatedViaJobId") REFERENCES "QuestionGenerationJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("commonMistake", "correctOption", "createdAt", "difficulty", "explanationVi", "generatedViaJobId", "id", "knowledgeUnitId", "learningObjective", "optionA", "optionB", "optionC", "optionD", "passageId", "payload", "promptText", "questionCode", "responseFormat", "skill", "source", "sourceExam", "tags", "topic", "type", "updatedAt") SELECT "commonMistake", "correctOption", "createdAt", "difficulty", "explanationVi", "generatedViaJobId", "id", "knowledgeUnitId", "learningObjective", "optionA", "optionB", "optionC", "optionD", "passageId", "payload", "promptText", "questionCode", "responseFormat", "skill", "source", "sourceExam", "tags", "topic", "type", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_questionCode_key" ON "Question"("questionCode");
CREATE INDEX "Question_skill_topic_idx" ON "Question"("skill", "topic");
CREATE INDEX "Question_type_idx" ON "Question"("type");
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
    "mockTestAttemptId" TEXT,
    "programCurriculumId" TEXT,
    CONSTRAINT "QuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_mockTestAttemptId_fkey" FOREIGN KEY ("mockTestAttemptId") REFERENCES "MockTestAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_programCurriculumId_fkey" FOREIGN KEY ("programCurriculumId") REFERENCES "ProgramCurriculum" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuestionAttempt" ("attemptedAt", "id", "isCorrect", "mockTestAttemptId", "programCurriculumId", "questionId", "response", "score", "selectedOption", "timeSpentSec", "userId") SELECT "attemptedAt", "id", "isCorrect", "mockTestAttemptId", "programCurriculumId", "questionId", "response", "score", "selectedOption", "timeSpentSec", "userId" FROM "QuestionAttempt";
DROP TABLE "QuestionAttempt";
ALTER TABLE "new_QuestionAttempt" RENAME TO "QuestionAttempt";
CREATE INDEX "QuestionAttempt_userId_questionId_idx" ON "QuestionAttempt"("userId", "questionId");
CREATE INDEX "QuestionAttempt_userId_mockTestAttemptId_idx" ON "QuestionAttempt"("userId", "mockTestAttemptId");
CREATE INDEX "QuestionAttempt_userId_programCurriculumId_idx" ON "QuestionAttempt"("userId", "programCurriculumId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

