-- CreateTable
CREATE TABLE "GeneratedQuestionDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationJobId" TEXT NOT NULL,
    "knowledgeUnitId" TEXT NOT NULL,
    "questionCode" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctOption" TEXT NOT NULL,
    "explanationVi" TEXT NOT NULL,
    "commonMistake" TEXT,
    "learningObjective" TEXT,
    "questionType" TEXT NOT NULL,
    "questionSkill" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNote" TEXT,
    "validationStatus" TEXT NOT NULL DEFAULT 'PASS',
    "validationIssues" TEXT,
    "approvedQuestionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GeneratedQuestionDraft_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "QuestionGenerationJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GeneratedQuestionDraft_knowledgeUnitId_fkey" FOREIGN KEY ("knowledgeUnitId") REFERENCES "KnowledgeUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GeneratedQuestionDraft_generationJobId_status_idx" ON "GeneratedQuestionDraft"("generationJobId", "status");
