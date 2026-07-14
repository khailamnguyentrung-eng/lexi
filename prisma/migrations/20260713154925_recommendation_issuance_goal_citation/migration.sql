-- AlterTable
ALTER TABLE "RecommendationIssuance" ADD COLUMN "goalTargetDate" DATETIME;
ALTER TABLE "RecommendationIssuance" ADD COLUMN "goalTargetExam" TEXT;
ALTER TABLE "RecommendationIssuance" ADD COLUMN "goalTargetScore" REAL;
