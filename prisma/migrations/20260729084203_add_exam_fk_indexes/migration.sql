-- CreateIndex
CREATE INDEX "ExamSection_examSkillId_idx" ON "ExamSection"("examSkillId");

-- CreateIndex
CREATE INDEX "KnowledgeUnit_examId_idx" ON "KnowledgeUnit"("examId");

-- CreateIndex
CREATE INDEX "MockTestTemplate_examId_idx" ON "MockTestTemplate"("examId");

-- CreateIndex
CREATE INDEX "Question_examId_idx" ON "Question"("examId");

-- CreateIndex
CREATE INDEX "Question_examSkillId_idx" ON "Question"("examSkillId");
