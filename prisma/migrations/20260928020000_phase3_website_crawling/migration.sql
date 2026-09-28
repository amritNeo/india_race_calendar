ALTER TYPE "IngestionRunStatus" ADD VALUE 'BLOCKED';

CREATE TYPE "RobotsStatus" AS ENUM ('ALLOWED', 'DISALLOWED', 'UNKNOWN');

ALTER TABLE "EventSource"
  ADD COLUMN "crawlDepth" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "maxPagesPerRun" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "EventSource"
  ADD CONSTRAINT "EventSource_crawlDepth_check" CHECK ("crawlDepth" BETWEEN 1 AND 5),
  ADD CONSTRAINT "EventSource_maxPagesPerRun_check" CHECK ("maxPagesPerRun" BETWEEN 1 AND 100);

ALTER TABLE "IngestionRun"
  ADD COLUMN "robotsStatus" "RobotsStatus",
  ADD COLUMN "robotsReason" TEXT;
