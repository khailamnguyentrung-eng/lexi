-- CreateTable
CREATE TABLE "KnowledgeUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "targetEasyCount" INTEGER NOT NULL DEFAULT 5,
    "targetMediumCount" INTEGER NOT NULL DEFAULT 5,
    "targetHardCount" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KnowledgeUnitOnSession" (
    "knowledgeUnitId" TEXT NOT NULL,
    "curriculumSessionId" TEXT NOT NULL,

    PRIMARY KEY ("knowledgeUnitId", "curriculumSessionId"),
    CONSTRAINT "KnowledgeUnitOnSession_knowledgeUnitId_fkey" FOREIGN KEY ("knowledgeUnitId") REFERENCES "KnowledgeUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeUnitOnSession_curriculumSessionId_fkey" FOREIGN KEY ("curriculumSessionId") REFERENCES "CurriculumSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionGenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExtractedQuestionDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "normalizedData" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "importedQuestionId" TEXT,
    "generationJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExtractedQuestionDraft_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExtractedQuestionDraft_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExtractedQuestionDraft_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "QuestionGenerationJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ExtractedQuestionDraft" ("createdAt", "id", "importJobId", "importedQuestionId", "normalizedData", "reviewNote", "reviewStatus", "reviewedByUserId", "updatedAt") SELECT "createdAt", "id", "importJobId", "importedQuestionId", "normalizedData", "reviewNote", "reviewStatus", "reviewedByUserId", "updatedAt" FROM "ExtractedQuestionDraft";
DROP TABLE "ExtractedQuestionDraft";
ALTER TABLE "new_ExtractedQuestionDraft" RENAME TO "ExtractedQuestionDraft";
CREATE INDEX "ExtractedQuestionDraft_importJobId_reviewStatus_idx" ON "ExtractedQuestionDraft"("importJobId", "reviewStatus");
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionCode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "topic" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
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
INSERT INTO "new_Question" ("commonMistake", "correctOption", "createdAt", "curriculumSessionId", "difficulty", "explanationVi", "id", "learningObjective", "optionA", "optionB", "optionC", "optionD", "passageId", "promptText", "questionCode", "skill", "source", "sourceExam", "tags", "topic", "type", "updatedAt") SELECT "commonMistake", "correctOption", "createdAt", "curriculumSessionId", "difficulty", "explanationVi", "id", "learningObjective", "optionA", "optionB", "optionC", "optionD", "passageId", "promptText", "questionCode", "skill", "source", "sourceExam", "tags", "topic", "type", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_questionCode_key" ON "Question"("questionCode");
CREATE INDEX "Question_skill_topic_idx" ON "Question"("skill", "topic");
CREATE INDEX "Question_type_idx" ON "Question"("type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeUnit_topic_key" ON "KnowledgeUnit"("topic");

-- CreateIndex
CREATE INDEX "KnowledgeUnit_topic_idx" ON "KnowledgeUnit"("topic");
