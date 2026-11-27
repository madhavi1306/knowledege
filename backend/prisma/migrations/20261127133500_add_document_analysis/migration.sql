CREATE TYPE "ProcessingStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ConceptRelationshipType" AS ENUM ('PREREQUISITE', 'RELATED', 'DEPENDS_ON');

CREATE TABLE "DocumentAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "subject" VARCHAR(240),
    "status" "ProcessingStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stage" VARCHAR(160),
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtractedPage" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentAnalysisId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "originalText" TEXT NOT NULL,
    "textContext" TEXT NOT NULL,
    "section" VARCHAR(500) NOT NULL,
    "headings" JSONB NOT NULL,
    "subheadings" JSONB NOT NULL,
    "paragraphs" JSONB NOT NULL,
    "definitions" JSONB NOT NULL,
    "examples" JSONB NOT NULL,
    "formulas" JSONB NOT NULL,
    "tables" JSONB NOT NULL,
    "importantTerms" JSONB NOT NULL,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtractedPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "documentAnalysisId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" VARCHAR(240) NOT NULL,
    "normalizedName" VARCHAR(240) NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Concept" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(240) NOT NULL,
    "normalizedName" VARCHAR(240) NOT NULL,
    "definition" TEXT NOT NULL,
    "detailedExplanation" TEXT NOT NULL,
    "examples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "formulas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importantFacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TopicConcept" (
    "topicId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    CONSTRAINT "TopicConcept_pkey" PRIMARY KEY ("topicId", "conceptId")
);

CREATE TABLE "ConceptSource" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "documentAnalysisId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "excerpt" TEXT NOT NULL,
    "sourceContext" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConceptSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConceptRelationship" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentAnalysisId" TEXT NOT NULL,
    "fromConceptId" TEXT NOT NULL,
    "toConceptId" TEXT NOT NULL,
    "type" "ConceptRelationshipType" NOT NULL,
    "evidence" TEXT NOT NULL,
    "sourcePageNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConceptRelationship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentAnalysis_documentId_key" ON "DocumentAnalysis"("documentId");
CREATE INDEX "DocumentAnalysis_userId_status_createdAt_idx" ON "DocumentAnalysis"("userId", "status", "createdAt");
CREATE UNIQUE INDEX "ExtractedPage_documentId_pageNumber_key" ON "ExtractedPage"("documentId", "pageNumber");
CREATE INDEX "ExtractedPage_documentAnalysisId_pageNumber_idx" ON "ExtractedPage"("documentAnalysisId", "pageNumber");
CREATE UNIQUE INDEX "Topic_documentAnalysisId_normalizedName_key" ON "Topic"("documentAnalysisId", "normalizedName");
CREATE INDEX "Topic_parentId_idx" ON "Topic"("parentId");
CREATE UNIQUE INDEX "Concept_userId_normalizedName_key" ON "Concept"("userId", "normalizedName");
CREATE INDEX "Concept_userId_updatedAt_idx" ON "Concept"("userId", "updatedAt");
CREATE INDEX "TopicConcept_conceptId_idx" ON "TopicConcept"("conceptId");
CREATE UNIQUE INDEX "ConceptSource_conceptId_documentAnalysisId_pageNumber_key" ON "ConceptSource"("conceptId", "documentAnalysisId", "pageNumber");
CREATE INDEX "ConceptSource_documentId_pageNumber_idx" ON "ConceptSource"("documentId", "pageNumber");
CREATE UNIQUE INDEX "ConceptRelationship_documentAnalysisId_fromConceptId_toConc_key" ON "ConceptRelationship"("documentAnalysisId", "fromConceptId", "toConceptId", "type");
CREATE INDEX "ConceptRelationship_userId_fromConceptId_idx" ON "ConceptRelationship"("userId", "fromConceptId");
CREATE INDEX "ConceptRelationship_userId_toConceptId_idx" ON "ConceptRelationship"("userId", "toConceptId");

ALTER TABLE "DocumentAnalysis" ADD CONSTRAINT "DocumentAnalysis_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAnalysis" ADD CONSTRAINT "DocumentAnalysis_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedPage" ADD CONSTRAINT "ExtractedPage_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedPage" ADD CONSTRAINT "ExtractedPage_documentAnalysisId_fkey"
    FOREIGN KEY ("documentAnalysisId") REFERENCES "DocumentAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_documentAnalysisId_fkey"
    FOREIGN KEY ("documentAnalysisId") REFERENCES "DocumentAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicConcept" ADD CONSTRAINT "TopicConcept_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicConcept" ADD CONSTRAINT "TopicConcept_conceptId_fkey"
    FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptSource" ADD CONSTRAINT "ConceptSource_conceptId_fkey"
    FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptSource" ADD CONSTRAINT "ConceptSource_documentAnalysisId_fkey"
    FOREIGN KEY ("documentAnalysisId") REFERENCES "DocumentAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptSource" ADD CONSTRAINT "ConceptSource_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptRelationship" ADD CONSTRAINT "ConceptRelationship_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptRelationship" ADD CONSTRAINT "ConceptRelationship_documentAnalysisId_fkey"
    FOREIGN KEY ("documentAnalysisId") REFERENCES "DocumentAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptRelationship" ADD CONSTRAINT "ConceptRelationship_fromConceptId_fkey"
    FOREIGN KEY ("fromConceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptRelationship" ADD CONSTRAINT "ConceptRelationship_toConceptId_fkey"
    FOREIGN KEY ("toConceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
