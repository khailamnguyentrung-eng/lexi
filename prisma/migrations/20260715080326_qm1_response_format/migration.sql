-- AlterTable
ALTER TABLE "QuestionAttempt" ADD COLUMN "response" TEXT;
ALTER TABLE "QuestionAttempt" ADD COLUMN "score" REAL;

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
    "curriculumSessionId" TEXT,
    "knowledgeUnitId" TEXT,
    "generatedViaJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_curriculumSessionId_fkey" FOREIGN KEY ("curriculumSessionId") REFERENCES "CurriculumSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_knowledgeUnitId_fkey" FOREIGN KEY ("knowledgeUnitId") REFERENCES "KnowledgeUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_generatedViaJobId_fkey" FOREIGN KEY ("generatedViaJobId") REFERENCES "QuestionGenerationJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("commonMistake", "correctOption", "createdAt", "curriculumSessionId", "difficulty", "explanationVi", "generatedViaJobId", "id", "knowledgeUnitId", "learningObjective", "optionA", "optionB", "optionC", "optionD", "passageId", "promptText", "questionCode", "skill", "source", "sourceExam", "tags", "topic", "type", "updatedAt") SELECT "commonMistake", "correctOption", "createdAt", "curriculumSessionId", "difficulty", "explanationVi", "generatedViaJobId", "id", "knowledgeUnitId", "learningObjective", "optionA", "optionB", "optionC", "optionD", "passageId", "promptText", "questionCode", "skill", "source", "sourceExam", "tags", "topic", "type", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_questionCode_key" ON "Question"("questionCode");
CREATE INDEX "Question_skill_topic_idx" ON "Question"("skill", "topic");
CREATE INDEX "Question_type_idx" ON "Question"("type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
