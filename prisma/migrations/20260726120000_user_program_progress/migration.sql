-- CreateTable
CREATE TABLE "UserProgramProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "programCurriculumId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "scoreAchieved" REAL,
    CONSTRAINT "UserProgramProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserProgramProgress_programCurriculumId_fkey" FOREIGN KEY ("programCurriculumId") REFERENCES "ProgramCurriculum" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProgramProgress_userId_programCurriculumId_key" ON "UserProgramProgress"("userId", "programCurriculumId");
