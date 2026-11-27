CREATE TYPE "DocumentUploadStatus" AS ENUM (
    'UPLOADED',
    'PROCESSING',
    'ANALYSIS_COMPLETED',
    'FAILED'
);

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "originalFileName" VARCHAR(255) NOT NULL,
    "storageKey" VARCHAR(80) NOT NULL,
    "contentHash" CHAR(64) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    "uploadStatus" "DocumentUploadStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");
CREATE UNIQUE INDEX "Document_userId_contentHash_key" ON "Document"("userId", "contentHash");
CREATE INDEX "Document_userId_uploadedAt_idx" ON "Document"("userId", "uploadedAt");
