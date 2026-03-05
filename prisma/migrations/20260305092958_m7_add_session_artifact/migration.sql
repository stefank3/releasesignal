-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "artifactJson" JSONB,
ADD COLUMN     "artifactUpdatedAt" TIMESTAMP(3);
