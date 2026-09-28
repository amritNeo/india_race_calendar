CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'SOLD_OUT', 'POSTPONED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "Discipline" AS ENUM ('RUN', 'BIKE', 'SWIM', 'WALK', 'ROW', 'OTHER');

CREATE TABLE "Country" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "code" TEXT NOT NULL,
  CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "State" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "countryId" TEXT NOT NULL,
  CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "City" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "stateId" TEXT NOT NULL,
  CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Venue" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "address" TEXT, "latitude" DECIMAL(9,6), "longitude" DECIMAL(9,6), "cityId" TEXT NOT NULL,
  CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Organizer" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "websiteUrl" TEXT, "description" TEXT,
  CONSTRAINT "Organizer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EventCategory" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "parentId" TEXT,
  CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Event" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT NOT NULL,
  "organizerId" TEXT, "venueId" TEXT, "cityId" TEXT NOT NULL, "categoryId" TEXT NOT NULL,
  "startDate" DATE NOT NULL, "endDate" DATE, "registrationUrl" TEXT, "officialWebsiteUrl" TEXT,
  "sourceName" TEXT, "sourceUrl" TEXT, "lastVerifiedAt" TIMESTAMP(3), "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "isDemo" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EventDistance" (
  "id" TEXT NOT NULL, "eventId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "discipline" "Discipline" NOT NULL DEFAULT 'OTHER', "distanceKm" DECIMAL(8,3), "sequence" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "EventDistance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");
CREATE INDEX "Country_name_idx" ON "Country"("name");
CREATE UNIQUE INDEX "State_slug_key" ON "State"("slug");
CREATE UNIQUE INDEX "State_countryId_name_key" ON "State"("countryId", "name");
CREATE INDEX "State_countryId_idx" ON "State"("countryId");
CREATE UNIQUE INDEX "City_slug_key" ON "City"("slug");
CREATE INDEX "City_stateId_idx" ON "City"("stateId");
CREATE INDEX "Venue_cityId_idx" ON "Venue"("cityId");
CREATE INDEX "Organizer_name_idx" ON "Organizer"("name");
CREATE UNIQUE INDEX "EventCategory_slug_key" ON "EventCategory"("slug");
CREATE INDEX "EventCategory_parentId_idx" ON "EventCategory"("parentId");
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_startDate_status_idx" ON "Event"("startDate", "status");
CREATE INDEX "Event_cityId_startDate_idx" ON "Event"("cityId", "startDate");
CREATE INDEX "Event_categoryId_startDate_idx" ON "Event"("categoryId", "startDate");
CREATE INDEX "Event_status_idx" ON "Event"("status");
CREATE INDEX "EventDistance_eventId_sequence_idx" ON "EventDistance"("eventId", "sequence");

ALTER TABLE "State" ADD CONSTRAINT "State_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "City" ADD CONSTRAINT "City_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventCategory" ADD CONSTRAINT "EventCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "EventCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventDistance" ADD CONSTRAINT "EventDistance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
