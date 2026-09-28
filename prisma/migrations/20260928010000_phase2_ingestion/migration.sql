ALTER TYPE "EventStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "EventStatus" ADD VALUE 'REJECTED';

CREATE TYPE "EventSourceType" AS ENUM ('MANUAL', 'API', 'RSS', 'WEB', 'OTHER');
CREATE TYPE "RawEventStatus" AS ENUM ('DISCOVERED', 'PROCESSING', 'NORMALIZED', 'FAILED', 'IGNORED');
CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED');
CREATE TYPE "DuplicateDecisionType" AS ENUM ('KEEP_SEPARATE', 'IGNORED');

ALTER TABLE "Event" ADD COLUMN "duplicateKey" TEXT;
CREATE INDEX "Event_duplicateKey_idx" ON "Event"("duplicateKey");

CREATE TABLE "CityAlias" (
  "id" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "cityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CityAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CityAlias_alias_key" ON "CityAlias"("alias");
CREATE INDEX "CityAlias_cityId_idx" ON "CityAlias"("cityId");
ALTER TABLE "CityAlias" ADD CONSTRAINT "CityAlias_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventSource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" "EventSourceType" NOT NULL,
  "baseUrl" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "lastRunAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "lastErrorAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventSource_slug_key" ON "EventSource"("slug");
CREATE INDEX "EventSource_enabled_idx" ON "EventSource"("enabled");

CREATE TABLE "EventSourceRecord" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "externalId" TEXT,
  "sourceUrl" TEXT,
  "registrationUrl" TEXT,
  "officialWebsiteUrl" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "originalTitle" TEXT,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventSourceRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventSourceRecord_sourceId_externalId_key" ON "EventSourceRecord"("sourceId", "externalId");
CREATE INDEX "EventSourceRecord_eventId_idx" ON "EventSourceRecord"("eventId");
CREATE INDEX "EventSourceRecord_sourceId_idx" ON "EventSourceRecord"("sourceId");
ALTER TABLE "EventSourceRecord" ADD CONSTRAINT "EventSourceRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventSourceRecord" ADD CONSTRAINT "EventSourceRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RawEvent" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "eventId" TEXT,
  "externalId" TEXT,
  "sourceUrl" TEXT,
  "rawPayload" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "status" "RawEventStatus" NOT NULL DEFAULT 'DISCOVERED',
  "errorMessage" TEXT,
  "validationErrors" JSONB,
  CONSTRAINT "RawEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RawEvent_sourceId_contentHash_key" ON "RawEvent"("sourceId", "contentHash");
CREATE INDEX "RawEvent_sourceId_idx" ON "RawEvent"("sourceId");
CREATE INDEX "RawEvent_externalId_idx" ON "RawEvent"("externalId");
CREATE INDEX "RawEvent_status_discoveredAt_idx" ON "RawEvent"("status", "discoveredAt");
CREATE INDEX "RawEvent_eventId_idx" ON "RawEvent"("eventId");
ALTER TABLE "RawEvent" ADD CONSTRAINT "RawEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RawEvent" ADD CONSTRAINT "RawEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "IngestionRun" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
  "recordsDiscovered" INTEGER NOT NULL DEFAULT 0,
  "recordsCreated" INTEGER NOT NULL DEFAULT 0,
  "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
  "recordsRejected" INTEGER NOT NULL DEFAULT 0,
  "duplicatesFound" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IngestionRun_sourceId_startedAt_idx" ON "IngestionRun"("sourceId", "startedAt");
CREATE INDEX "IngestionRun_status_idx" ON "IngestionRun"("status");
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DuplicatePairDecision" (
  "id" TEXT NOT NULL,
  "pairKey" TEXT NOT NULL,
  "decision" "DuplicateDecisionType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DuplicatePairDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DuplicatePairDecision_pairKey_key" ON "DuplicatePairDecision"("pairKey");
CREATE INDEX "DuplicatePairDecision_decision_idx" ON "DuplicatePairDecision"("decision");

-- Ingestion and review data is server-only. Keep it inaccessible through the
-- Supabase Data API until an authenticated admin access model exists.
ALTER TABLE "Country" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "State" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "City" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Venue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organizer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventDistance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CityAlias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventSourceRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RawEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IngestionRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DuplicatePairDecision" ENABLE ROW LEVEL SECURITY;
