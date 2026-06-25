-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LearnerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gradeLevel" TEXT NOT NULL DEFAULT 'grade9',
    "targetExam" TEXT NOT NULL DEFAULT 'hanoi_thpt_2027',
    "targetScore" REAL NOT NULL,
    "currentScore" REAL,
    "diagnosticScore" REAL,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "learningHistory" TEXT,
    "preferredAmbientSound" TEXT,
    "onboardingCompletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Passage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "bodyText" TEXT NOT NULL,
    "passageType" TEXT NOT NULL DEFAULT 'reading',
    "sourceProvince" TEXT,
    "sourceYear" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Question" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_curriculumSessionId_fkey" FOREIGN KEY ("curriculumSessionId") REFERENCES "CurriculumSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSpentSec" INTEGER,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ErrorNotebookEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT,
    "studentAnswer" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "isRemedialFlagged" BOOLEAN NOT NULL DEFAULT false,
    "reviewStage" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" DATETIME,
    "lastReviewedAt" DATETIME,
    "easeFactor" REAL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ErrorNotebookEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ErrorNotebookEntry_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillMatrixEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "percentage" REAL NOT NULL,
    "computedBy" TEXT NOT NULL DEFAULT 'MANUAL',
    "lastComputedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillMatrixEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startSession" INTEGER NOT NULL,
    "endSession" INTEGER NOT NULL,
    "goal" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CurriculumSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "grammarTopics" TEXT,
    "vocabThemes" TEXT,
    "exercises" TEXT,
    "resources" TEXT,
    "timeBlocks" TEXT NOT NULL,
    "unitMapping" TEXT,
    "sessionType" TEXT NOT NULL DEFAULT 'REGULAR',
    CONSTRAINT "CurriculumSession_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "CurriculumPhase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSessionProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "curriculumSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "completedAt" DATETIME,
    "scoreAchieved" REAL,
    CONSTRAINT "UserSessionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserSessionProgress_curriculumSessionId_fkey" FOREIGN KEY ("curriculumSessionId") REFERENCES "CurriculumSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'TEACHER',
    "title" TEXT,
    "contextSnapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "tokensUsed" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerProfile_userId_key" ON "LearnerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_questionCode_key" ON "Question"("questionCode");

-- CreateIndex
CREATE INDEX "Question_skill_topic_idx" ON "Question"("skill", "topic");

-- CreateIndex
CREATE INDEX "Question_type_idx" ON "Question"("type");

-- CreateIndex
CREATE INDEX "QuestionAttempt_userId_questionId_idx" ON "QuestionAttempt"("userId", "questionId");

-- CreateIndex
CREATE INDEX "ErrorNotebookEntry_userId_nextReviewAt_idx" ON "ErrorNotebookEntry"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "ErrorNotebookEntry_userId_concept_idx" ON "ErrorNotebookEntry"("userId", "concept");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMatrixEntry_userId_skill_key" ON "SkillMatrixEntry"("userId", "skill");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumSession_sessionNumber_key" ON "CurriculumSession"("sessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "UserSessionProgress_userId_curriculumSessionId_key" ON "UserSessionProgress"("userId", "curriculumSessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_chatSessionId_createdAt_idx" ON "ChatMessage"("chatSessionId", "createdAt");
