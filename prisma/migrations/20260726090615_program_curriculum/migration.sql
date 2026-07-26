-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetExam" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProgramCurriculum" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "sessionType" TEXT NOT NULL DEFAULT 'REGULAR',
    CONSTRAINT "ProgramCurriculum_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramCurriculumKnowledgeUnit" (
    "programCurriculumId" TEXT NOT NULL,
    "knowledgeUnitId" TEXT NOT NULL,

    PRIMARY KEY ("programCurriculumId", "knowledgeUnitId"),
    CONSTRAINT "ProgramCurriculumKnowledgeUnit_programCurriculumId_fkey" FOREIGN KEY ("programCurriculumId") REFERENCES "ProgramCurriculum" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProgramCurriculumKnowledgeUnit_knowledgeUnitId_fkey" FOREIGN KEY ("knowledgeUnitId") REFERENCES "KnowledgeUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Program_slug_key" ON "Program"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCurriculum_programId_order_key" ON "ProgramCurriculum"("programId", "order");
