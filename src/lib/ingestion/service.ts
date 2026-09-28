import { createHash } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { slugify } from "@/lib/domain";
import { eventDuplicateKey, fallbackExternalId, normalizeText, splitLocation, validateNormalizedEvent } from "./normalization";
import { nameSimilarity } from "./deduplication";
import { adapterFor } from "./registry";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function runSource(sourceId: string) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Database is required to run ingestion.");
  const source = await prisma.eventSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Ingestion source not found.");
  if (!source.enabled) throw new Error("This source is disabled.");
  const run = await prisma.ingestionRun.create({ data: { sourceId } });
  const counts = { recordsDiscovered: 0, recordsCreated: 0, recordsUpdated: 0, recordsRejected: 0, duplicatesFound: 0 };
  const failures: string[] = [];
  try {
    const adapter = adapterFor(source);
    const discovered = await adapter.discover();
    counts.recordsDiscovered = discovered.length;
    for (const raw of discovered) {
      let rawRowId: string | null = null;
      try {
        const rawJson = JSON.parse(JSON.stringify(raw));
        const contentHash = hash(JSON.stringify(rawJson));
        const rawRow = await prisma.rawEvent.upsert({
          where: { sourceId_contentHash: { sourceId, contentHash } },
          update: {},
          create: { sourceId, externalId: typeof raw.externalId === "string" ? raw.externalId : null, sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : null, rawPayload: rawJson, contentHash },
        });
        rawRowId = rawRow.id;
        if (rawRow.status === "NORMALIZED" || rawRow.status === "IGNORED") continue;
        const normalized = await adapter.normalize(raw);
        const location = splitLocation(normalized.city);
        const cityText = location.city;
        let city = cityText ? await prisma.city.findFirst({ where: { OR: [{ slug: slugify(cityText) }, { name: { equals: cityText, mode: "insensitive" } }, { aliases: { some: { alias: normalizeText(cityText) } } }] }, include: { state: true } }) : null;
        if (city && location.state && ![city.state.name.toLowerCase(), city.state.slug.toLowerCase()].includes(location.state.toLowerCase())) city = null;
        const categorySlug = normalized.category;
        const category = categorySlug ? await prisma.eventCategory.findUnique({ where: { slug: categorySlug } }) : null;
        const sourceUrl = typeof raw.sourceUrl === "string" ? raw.sourceUrl : undefined;
        const errors = validateNormalizedEvent(normalized, { cityId: city?.id, categoryId: category?.id }, sourceUrl);
        if (!city) errors.push(`City "${cityText || "(missing)"}" could not be matched to a known city.`);
        if (!category) errors.push(`Category "${normalized.category || "(missing)"}" could not be matched to a known category.`);
        const date = new Date(`${normalized.startDate}T00:00:00.000Z`);
        const externalId = typeof raw.externalId === "string" && raw.externalId.trim() ? raw.externalId.trim() : fallbackExternalId({ name: normalized.name, startDate: normalized.startDate, city: cityText, sourceSlug: source.slug });
        if (errors.length || !city || !category || Number.isNaN(date.valueOf())) {
          counts.recordsRejected++;
          await prisma.rawEvent.update({ where: { id: rawRow.id }, data: { status: "FAILED", processedAt: new Date(), errorMessage: errors.join(" "), validationErrors: errors } });
          continue;
        }
        const existingRecord = await prisma.eventSourceRecord.findUnique({ where: { sourceId_externalId: { sourceId, externalId } }, include: { event: true } });
        if (existingRecord) {
          await prisma.$transaction([
            prisma.eventSourceRecord.update({ where: { id: existingRecord.id }, data: { lastVerifiedAt: new Date(), sourceUrl, registrationUrl: normalized.registrationUrl || null, officialWebsiteUrl: normalized.officialWebsiteUrl || null, rawPayload: rawJson } }),
            prisma.rawEvent.update({ where: { id: rawRow.id }, data: { status: "NORMALIZED", eventId: existingRecord.eventId, processedAt: new Date() } }),
          ]);
          counts.recordsUpdated++;
          continue;
        }
        const key = eventDuplicateKey({ name: normalized.name, startDate: normalized.startDate, city: city.name });
        const eventSlugBase = slugify(`${normalized.name}-${normalized.startDate}-${city.slug}`) || `event-${contentHash.slice(0, 10)}`;
        const eventSlug = `${eventSlugBase}-${contentHash.slice(0, 6)}`;
        const similar = await prisma.event.findMany({ where: { cityId: city.id, startDate: date, status: { not: "REJECTED" } }, select: { name: true } });
        const isDuplicate = similar.some((candidate) => eventDuplicateKey({ name: candidate.name, startDate: normalized.startDate, city: city.name }) === key || nameSimilarity(candidate.name, normalized.name) >= 0.72);
        const event = await prisma.$transaction(async (tx) => {
          const organizer = normalized.organizer ? await tx.organizer.findFirst({ where: { name: { equals: normalized.organizer, mode: "insensitive" } } }) ?? await tx.organizer.create({ data: { name: normalized.organizer } }) : null;
          const venue = normalized.venue ? await tx.venue.create({ data: { name: normalized.venue, cityId: city.id } }) : null;
          const created = await tx.event.create({ data: {
            name: normalized.name,
            slug: eventSlug,
            description: normalized.description,
            cityId: city.id,
            categoryId: category.id,
            startDate: date,
            endDate: normalized.endDate ? new Date(`${normalized.endDate}T00:00:00.000Z`) : null,
            registrationUrl: normalized.registrationUrl || null,
            officialWebsiteUrl: normalized.officialWebsiteUrl || null,
            sourceName: source.name,
            sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : null,
            status: "PENDING_REVIEW",
            duplicateKey: key,
            organizerId: organizer?.id ?? null,
            venueId: venue?.id ?? null,
          } });
          if (normalized.distances?.length) await tx.eventDistance.createMany({ data: normalized.distances.map((distance, index) => ({ eventId: created.id, name: distance.name, distanceKm: distance.distanceKm ?? null, discipline: distance.discipline ?? "OTHER", sequence: index })) });
          await tx.eventSourceRecord.create({ data: { eventId: created.id, sourceId, externalId, sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : null, registrationUrl: normalized.registrationUrl || null, officialWebsiteUrl: normalized.officialWebsiteUrl || null, lastVerifiedAt: new Date(), originalTitle: typeof raw.title === "string" ? raw.title : normalized.name, rawPayload: rawJson } });
          await tx.rawEvent.update({ where: { id: rawRow.id }, data: { status: "NORMALIZED", eventId: created.id, processedAt: new Date(), errorMessage: null, validationErrors: [] } });
          return created;
        });
        void event;
        counts.recordsCreated++;
        if (isDuplicate) counts.duplicatesFound++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown record processing error.";
        failures.push(message);
        counts.recordsRejected++;
        if (rawRowId) await prisma.rawEvent.update({ where: { id: rawRowId }, data: { status: "FAILED", processedAt: new Date(), errorMessage: message } }).catch(() => undefined);
      }
    }
    const status = failures.length ? counts.recordsCreated || counts.recordsUpdated ? "PARTIAL_SUCCESS" : "FAILED" : counts.recordsRejected ? "PARTIAL_SUCCESS" : "SUCCESS";
    await prisma.$transaction([
      prisma.ingestionRun.update({ where: { id: run.id }, data: { ...counts, completedAt: new Date(), status, errorMessage: failures.length ? failures.slice(0, 10).join("\n") : null } }),
      prisma.eventSource.update({ where: { id: sourceId }, data: { lastRunAt: new Date(), ...(status === "SUCCESS" || status === "PARTIAL_SUCCESS" ? { lastSuccessAt: new Date() } : { lastErrorAt: new Date() }) } }),
    ]);
    return { runId: run.id, status, ...counts };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion error.";
    await prisma.$transaction([
      prisma.ingestionRun.update({ where: { id: run.id }, data: { ...counts, completedAt: new Date(), status: "FAILED", errorMessage: message } }),
      prisma.eventSource.update({ where: { id: sourceId }, data: { lastRunAt: new Date(), lastErrorAt: new Date() } }),
    ]);
    throw error;
  }
}
