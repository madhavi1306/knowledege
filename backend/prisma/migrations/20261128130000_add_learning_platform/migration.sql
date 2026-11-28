-- Add fields introduced after the original analysis migration.
ALTER TABLE "Topic" ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Concept"
    ADD COLUMN "simpleExplanation" TEXT,
    ADD COLUMN "analogy" TEXT,
    ADD COLUMN "realLifeExample" TEXT,
    ADD COLUMN "stepByStepExplanation" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "misconceptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "learningObjectives" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "difficulty" VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN "importance" VARCHAR(50) NOT NULL DEFAULT 'HIGH';

-- CreateEnum
CREATE TYPE "VisualType" AS ENUM ('DIAGRAM', 'FLOWCHART', 'MAP', 'GRAPH', 'CHART', 'TABLE', 'ILLUSTRATION', 'ARCHITECTURE', 'IMAGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MasteryStatus" AS ENUM ('NOT_LEARNED', 'LEARNING', 'WEAK', 'IMPROVING', 'MASTERED', 'REVISION_REQUIRED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_BLANKS', 'SHORT_ANSWER', 'APPLICATION', 'SCENARIO', 'COMPARISON', 'PROBLEM_SOLVING', 'CONCEPT_BASED');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'DIFFICULT', 'APPLICATION', 'ANALYTICAL');

-- CreateTable
CREATE TABLE "TopicLearningMaterial" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentAnalysisId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "chapterTitle" VARCHAR(240),
    "topicTitle" VARCHAR(240) NOT NULL,
    "simpleDefinition" TEXT NOT NULL,
    "easyExplanation" TEXT NOT NULL,
    "detailedExplanation" TEXT NOT NULL,
    "stepByStepExplanation" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "realWorldExample" TEXT NOT NULL,
    "importantPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficultWords" JSONB NOT NULL DEFAULT '[]',
    "relatedConcepts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pageReferences" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "quickRevisionNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keyThingsToRemember" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
    "generationStatus" VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    "generationError" TEXT,
    "lastGeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicLearningMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptMastery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "status" "MasteryStatus" NOT NULL DEFAULT 'NOT_LEARNED',
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "correctAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastAssessedAt" TIMESTAMP(3),
    "lastReteachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConceptMastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "documentAnalysisId" TEXT,
    "scope" VARCHAR(50) NOT NULL DEFAULT 'DOCUMENT',
    "topicId" TEXT,
    "topicName" VARCHAR(240),
    "chapterTitle" VARCHAR(240),
    "mode" VARCHAR(50) NOT NULL DEFAULT 'COMPREHENSIVE',
    "difficulty" VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "scorePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "evaluationSummary" JSONB,
    "topicPerformance" JSONB DEFAULT '[]',
    "weakConceptNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strongConceptNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizSessionId" TEXT NOT NULL,
    "conceptId" TEXT,
    "conceptName" VARCHAR(240) NOT NULL,
    "topicName" VARCHAR(240),
    "pageNumber" INTEGER,
    "questionText" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "documentExcerpt" TEXT,
    "userAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "gapAnalysis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoverySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizSessionId" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
    "weakConceptNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overallProgress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoverySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryStep" (
    "id" TEXT NOT NULL,
    "recoverySessionId" TEXT NOT NULL,
    "conceptId" TEXT,
    "conceptName" VARCHAR(240) NOT NULL,
    "stepOrder" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "approachUsed" VARCHAR(50) NOT NULL DEFAULT 'ANALOGY',
    "reteachContent" JSONB,
    "miniTestScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpacedReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "lastReviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpacedReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVisual" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentAnalysisId" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "visualIndex" INTEGER NOT NULL DEFAULT 0,
    "type" "VisualType" NOT NULL DEFAULT 'DIAGRAM',
    "imagePath" VARCHAR(500),
    "storageKey" VARCHAR(240),
    "caption" VARCHAR(500),
    "boundingBox" JSONB,
    "title" VARCHAR(300) NOT NULL,
    "whatItRepresents" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "partsExplanation" JSONB NOT NULL DEFAULT '[]',
    "labelsExplanation" JSONB NOT NULL DEFAULT '[]',
    "arrowsExplanation" TEXT,
    "connections" JSONB NOT NULL DEFAULT '[]',
    "stepByStepProcess" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "easyExample" TEXT,
    "difficultWords" JSONB NOT NULL DEFAULT '[]',
    "importantPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "simplifiedDiagram" TEXT,
    "simplifiedDiagramType" VARCHAR(50) DEFAULT 'mermaid',
    "associatedTopicId" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentVisual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "topicId" TEXT,
    "title" VARCHAR(240) NOT NULL DEFAULT 'Document Q&A Session',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "directAnswer" TEXT,
    "simpleExplanation" TEXT,
    "example" TEXT,
    "importantPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pageReferences" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "retrievedChunks" JSONB NOT NULL DEFAULT '[]',
    "citations" JSONB NOT NULL DEFAULT '[]',
    "supplementary" BOOLEAN NOT NULL DEFAULT false,
    "notCovered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeakTopicRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "topicId" TEXT,
    "topicName" VARCHAR(240) NOT NULL,
    "chapterTitle" VARCHAR(240),
    "status" VARCHAR(50) NOT NULL DEFAULT 'NEEDS_REVISION',
    "initialScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currentScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "improvementDelta" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "attemptsCount" INTEGER NOT NULL DEFAULT 1,
    "detectionReason" TEXT NOT NULL,
    "incorrectAnswersHistory" JSONB NOT NULL DEFAULT '[]',
    "recommendation" TEXT NOT NULL,
    "adaptiveReteach" JSONB,
    "lastAssessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRevisedAt" TIMESTAMP(3),
    "lastRetestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeakTopicRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicRevisionSession" (
    "id" TEXT NOT NULL,
    "weakTopicRecordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "topicName" VARCHAR(240) NOT NULL,
    "previousScore" DOUBLE PRECISION NOT NULL,
    "retestScore" DOUBLE PRECISION,
    "improvementDelta" DOUBLE PRECISION,
    "practiceQuestions" JSONB NOT NULL DEFAULT '[]',
    "retestQuestions" JSONB NOT NULL DEFAULT '[]',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicRevisionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "topicId" TEXT,
    "eventType" VARCHAR(60) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopicLearningMaterial_topicId_key" ON "TopicLearningMaterial"("topicId");

-- CreateIndex
CREATE INDEX "TopicLearningMaterial_documentId_orderIndex_idx" ON "TopicLearningMaterial"("documentId", "orderIndex");

-- CreateIndex
CREATE INDEX "TopicLearningMaterial_userId_status_idx" ON "TopicLearningMaterial"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptMastery_conceptId_key" ON "ConceptMastery"("conceptId");

-- CreateIndex
CREATE INDEX "ConceptMastery_userId_status_idx" ON "ConceptMastery"("userId", "status");

-- CreateIndex
CREATE INDEX "QuizSession_userId_createdAt_idx" ON "QuizSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "QuizSession_documentId_createdAt_idx" ON "QuizSession"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizSessionId_idx" ON "QuizQuestion"("quizSessionId");

-- CreateIndex
CREATE INDEX "QuizQuestion_conceptId_idx" ON "QuizQuestion"("conceptId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoverySession_quizSessionId_key" ON "RecoverySession"("quizSessionId");

-- CreateIndex
CREATE INDEX "RecoverySession_userId_status_idx" ON "RecoverySession"("userId", "status");

-- CreateIndex
CREATE INDEX "RecoveryStep_recoverySessionId_stepOrder_idx" ON "RecoveryStep"("recoverySessionId", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SpacedReview_conceptId_key" ON "SpacedReview"("conceptId");

-- CreateIndex
CREATE INDEX "SpacedReview_userId_nextReviewDate_idx" ON "SpacedReview"("userId", "nextReviewDate");

-- CreateIndex
CREATE INDEX "DocumentVisual_documentId_pageNumber_idx" ON "DocumentVisual"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "DocumentVisual_documentId_type_idx" ON "DocumentVisual"("documentId", "type");

-- CreateIndex
CREATE INDEX "DocumentChatSession_userId_documentId_idx" ON "DocumentChatSession"("userId", "documentId");

-- CreateIndex
CREATE INDEX "DocumentChatSession_documentId_updatedAt_idx" ON "DocumentChatSession"("documentId", "updatedAt");

-- CreateIndex
CREATE INDEX "DocumentChatMessage_sessionId_createdAt_idx" ON "DocumentChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "WeakTopicRecord_userId_status_idx" ON "WeakTopicRecord"("userId", "status");

-- CreateIndex
CREATE INDEX "WeakTopicRecord_documentId_status_idx" ON "WeakTopicRecord"("documentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WeakTopicRecord_userId_documentId_topicName_key" ON "WeakTopicRecord"("userId", "documentId", "topicName");

-- CreateIndex
CREATE INDEX "TopicRevisionSession_weakTopicRecordId_idx" ON "TopicRevisionSession"("weakTopicRecordId");

-- CreateIndex
CREATE INDEX "TopicRevisionSession_userId_documentId_idx" ON "TopicRevisionSession"("userId", "documentId");

-- CreateIndex
CREATE INDEX "LearningActivityEvent_userId_createdAt_idx" ON "LearningActivityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LearningActivityEvent_userId_documentId_idx" ON "LearningActivityEvent"("userId", "documentId");

-- AddForeignKey
ALTER TABLE "TopicLearningMaterial" ADD CONSTRAINT "TopicLearningMaterial_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicLearningMaterial" ADD CONSTRAINT "TopicLearningMaterial_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicLearningMaterial" ADD CONSTRAINT "TopicLearningMaterial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptMastery" ADD CONSTRAINT "ConceptMastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptMastery" ADD CONSTRAINT "ConceptMastery_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSession" ADD CONSTRAINT "QuizSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSession" ADD CONSTRAINT "QuizSession_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizSessionId_fkey" FOREIGN KEY ("quizSessionId") REFERENCES "QuizSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoverySession" ADD CONSTRAINT "RecoverySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoverySession" ADD CONSTRAINT "RecoverySession_quizSessionId_fkey" FOREIGN KEY ("quizSessionId") REFERENCES "QuizSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryStep" ADD CONSTRAINT "RecoveryStep_recoverySessionId_fkey" FOREIGN KEY ("recoverySessionId") REFERENCES "RecoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryStep" ADD CONSTRAINT "RecoveryStep_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpacedReview" ADD CONSTRAINT "SpacedReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpacedReview" ADD CONSTRAINT "SpacedReview_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVisual" ADD CONSTRAINT "DocumentVisual_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChatSession" ADD CONSTRAINT "DocumentChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChatSession" ADD CONSTRAINT "DocumentChatSession_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChatMessage" ADD CONSTRAINT "DocumentChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DocumentChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeakTopicRecord" ADD CONSTRAINT "WeakTopicRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeakTopicRecord" ADD CONSTRAINT "WeakTopicRecord_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicRevisionSession" ADD CONSTRAINT "TopicRevisionSession_weakTopicRecordId_fkey" FOREIGN KEY ("weakTopicRecordId") REFERENCES "WeakTopicRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningActivityEvent" ADD CONSTRAINT "LearningActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningActivityEvent" ADD CONSTRAINT "LearningActivityEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
