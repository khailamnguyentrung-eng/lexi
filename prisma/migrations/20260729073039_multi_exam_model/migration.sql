-- AlterTable
ALTER TABLE "ContentSource" ADD COLUMN "sourceRole" TEXT;

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalQuestions" INTEGER NOT NULL,
    "timeAllowedMin" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExamSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "ExamSkill_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "examSkillId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "timeAllowedMin" INTEGER,
    CONSTRAINT "ExamSection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamSection_examSkillId_fkey" FOREIGN KEY ("examSkillId") REFERENCES "ExamSkill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KnowledgeUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "examId" TEXT,
    "label" TEXT NOT NULL,
    "targetEasyCount" INTEGER NOT NULL DEFAULT 5,
    "targetMediumCount" INTEGER NOT NULL DEFAULT 5,
    "targetHardCount" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeUnit_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_KnowledgeUnit" ("createdAt", "id", "label", "targetEasyCount", "targetHardCount", "targetMediumCount", "topic", "updatedAt") SELECT "createdAt", "id", "label", "targetEasyCount", "targetHardCount", "targetMediumCount", "topic", "updatedAt" FROM "KnowledgeUnit";
DROP TABLE "KnowledgeUnit";
ALTER TABLE "new_KnowledgeUnit" RENAME TO "KnowledgeUnit";
CREATE UNIQUE INDEX "KnowledgeUnit_topic_key" ON "KnowledgeUnit"("topic");
CREATE INDEX "KnowledgeUnit_topic_idx" ON "KnowledgeUnit"("topic");
CREATE TABLE "new_MockTestTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "timeLimitMin" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "examId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MockTestTemplate_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MockTestTemplate" ("createdAt", "description", "id", "timeLimitMin", "title", "totalQuestions") SELECT "createdAt", "description", "id", "timeLimitMin", "title", "totalQuestions" FROM "MockTestTemplate";
DROP TABLE "MockTestTemplate";
ALTER TABLE "new_MockTestTemplate" RENAME TO "MockTestTemplate";
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
    "examId" TEXT,
    "examSkillId" TEXT,
    "generatedViaJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_knowledgeUnitId_fkey" FOREIGN KEY ("knowledgeUnitId") REFERENCES "KnowledgeUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Question_examSkillId_fkey" FOREIGN KEY ("examSkillId") REFERENCES "ExamSkill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Question_generatedViaJobId_fkey" FOREIGN KEY ("generatedViaJobId") REFERENCES "QuestionGenerationJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("commonMistake", "correctOption", "createdAt", "difficulty", "explanationVi", "generatedViaJobId", "id", "knowledgeUnitId", "learningObjective", "optionA", "optionB", "optionC", "optionD", "passageId", "payload", "promptText", "questionCode", "responseFormat", "skill", "source", "sourceExam", "tags", "topic", "type", "updatedAt") SELECT "commonMistake", "correctOption", "createdAt", "difficulty", "explanationVi", "generatedViaJobId", "id", "knowledgeUnitId", "learningObjective", "optionA", "optionB", "optionC", "optionD", "passageId", "payload", "promptText", "questionCode", "responseFormat", "skill", "source", "sourceExam", "tags", "topic", "type", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_questionCode_key" ON "Question"("questionCode");
CREATE INDEX "Question_skill_topic_idx" ON "Question"("skill", "topic");
CREATE INDEX "Question_type_idx" ON "Question"("type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Exam_slug_key" ON "Exam"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSkill_examId_code_key" ON "ExamSkill"("examId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSection_examId_code_key" ON "ExamSection"("examId", "code");
