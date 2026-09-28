"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import type { EventStatus } from "@/generated/prisma/client";
import { slugify, validateEvent } from "@/lib/domain";
import { runSource } from "@/lib/ingestion/service";
import { eventDuplicateKey, normalizeText } from "@/lib/ingestion/normalization";
import { mergeDistances, mergeEventDetails } from "@/lib/ingestion/deduplication";

function writableAdmin() {
  if (process.env.NODE_ENV === "production") throw new Error("Admin editing is disabled in production until authentication is configured.");
  const prisma = getPrisma();
  if (!prisma) throw new Error("Admin actions require a configured database.");
  return prisma;
}

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function saveEventAction(form: FormData) {
  const prisma = writableAdmin();
  const id = value(form, "id");
  const name = value(form, "name");
  const description = value(form, "description");
  const cityId = value(form, "cityId");
  const categoryId = value(form, "categoryId");
  const startDate = value(form, "startDate");
  const endDate = value(form, "endDate");
  const registrationUrl = value(form, "registrationUrl");
  const officialWebsiteUrl = value(form, "officialWebsiteUrl");
  const rawId = value(form, "rawId");
  const externalIdInput = value(form, "externalId");
  const distances = [1, 2, 3, 4].flatMap((index) => {
    const distanceName = value(form, `distance${index}Name`);
    if (!distanceName) return [];
    const rawKm = value(form, `distance${index}Km`);
    const discipline = value(form, `distance${index}Discipline`);
    return [{ name: distanceName, distanceKm: rawKm ? Number(rawKm) : null, discipline: ["RUN", "BIKE", "SWIM", "WALK", "ROW", "OTHER"].includes(discipline) ? discipline as "RUN" | "BIKE" | "SWIM" | "WALK" | "ROW" | "OTHER" : "OTHER" }];
  });
  const errors = validateEvent({ name, cityId, categoryId, startDate, endDate, registrationUrl, officialWebsiteUrl, sourceUrl: value(form, "sourceUrl"), distances });
  if (errors.length) throw new Error(errors.join(" "));
  const city = await prisma.city.findUniqueOrThrow({ where: { id: cityId } });
  const selectedSourceId = value(form, "sourceId");
  const selectedSource = selectedSourceId ? await prisma.eventSource.findUnique({ where: { id: selectedSourceId } }) : null;
  const statusValue = value(form, "status");
  const status: EventStatus = statusValue === "PUBLISHED" ? "PUBLISHED" : "PENDING_REVIEW";
  const slugBase = slugify(name) || "event";
  const slug = id ? undefined : `${slugBase}-${startDate}-${city.slug}`;
  const organizerName = value(form, "organizer");
  const venueName = value(form, "venue");
  const payload = {
    name, description, cityId, categoryId, startDate: new Date(`${startDate}T00:00:00.000Z`),
    endDate: endDate ? new Date(`${endDate}T00:00:00.000Z`) : null,
    registrationUrl: registrationUrl || null,
    officialWebsiteUrl: officialWebsiteUrl || null,
    sourceName: value(form, "sourceName") && value(form, "sourceName") !== "Manual entry" ? value(form, "sourceName") : selectedSource?.name ?? "Manual entry",
    sourceUrl: value(form, "sourceUrl") || null,
    status,
    duplicateKey: eventDuplicateKey({ name, startDate, city: city.name }),
  };
  const event = await prisma.$transaction(async (tx) => {
    const organizer = organizerName ? await tx.organizer.findFirst({ where: { name: { equals: organizerName, mode: "insensitive" } } }) ?? await tx.organizer.create({ data: { name: organizerName } }) : null;
    const venue = venueName ? await tx.venue.findFirst({ where: { name: { equals: venueName, mode: "insensitive" }, cityId } }) ?? await tx.venue.create({ data: { name: venueName, cityId } }) : null;
    const eventData = { ...payload, organizerId: organizer?.id ?? null, venueId: venue?.id ?? null };
    const savedEvent = id
      ? await tx.event.update({ where: { id }, data: eventData })
      : await tx.event.create({ data: { ...eventData, slug: `${slug}-${Date.now().toString(36)}` } });
    await tx.eventDistance.deleteMany({ where: { eventId: savedEvent.id } });
    if (distances.length) await tx.eventDistance.createMany({ data: distances.map((distance, index) => ({ eventId: savedEvent.id, name: distance.name, distanceKm: distance.distanceKm, discipline: distance.discipline, sequence: index })) });
    if (!id || rawId || selectedSourceId) {
      let source = selectedSource;
      if (!source) source = await tx.eventSource.findUnique({ where: { slug: "manual" } });
      if (!source) source = await tx.eventSource.create({ data: { name: "Manual entry", slug: "manual", type: "MANUAL", enabled: true } });
      const externalId = externalIdInput || `manual:${savedEvent.id}`;
      await tx.eventSourceRecord.upsert({
      where: { sourceId_externalId: { sourceId: source.id, externalId } },
        update: { eventId: savedEvent.id, sourceUrl: value(form, "sourceUrl") || null, registrationUrl: registrationUrl || null, officialWebsiteUrl: officialWebsiteUrl || null, originalTitle: name },
        create: { eventId: savedEvent.id, sourceId: source.id, externalId, sourceUrl: value(form, "sourceUrl") || null, registrationUrl: registrationUrl || null, officialWebsiteUrl: officialWebsiteUrl || null, originalTitle: name, rawPayload: { name, description, startDate, endDate, registrationUrl, officialWebsiteUrl, organizer: organizerName, venue: venueName, distances } },
      });
    }
    const alias = value(form, "cityAlias");
    if (alias) { const normalizedAlias = normalizeText(alias); await tx.cityAlias.upsert({ where: { alias: normalizedAlias }, update: { cityId }, create: { alias: normalizedAlias, cityId } }); }
    if (rawId) await tx.rawEvent.update({ where: { id: rawId }, data: { eventId: savedEvent.id, status: "NORMALIZED", processedAt: new Date(), errorMessage: null, validationErrors: [] } });
    return savedEvent;
  });
  revalidatePath("/"); revalidatePath("/events"); revalidatePath("/admin");
  redirect(`/admin/events/${event.id}`);
}

export async function approveEventAction(form: FormData) {
  const prisma = writableAdmin();
  await prisma.event.update({ where: { id: value(form, "id") }, data: { status: "PUBLISHED" } });
  revalidatePath("/"); revalidatePath("/events"); revalidatePath("/admin");
  redirect("/admin/events/pending");
}

export async function rejectEventAction(form: FormData) {
  const prisma = writableAdmin();
  await prisma.event.update({ where: { id: value(form, "id") }, data: { status: "REJECTED" } });
  revalidatePath("/"); revalidatePath("/events"); revalidatePath("/admin");
  redirect("/admin/events/pending");
}

export async function ignoreRawEventAction(form: FormData) {
  const prisma = writableAdmin();
  await prisma.rawEvent.update({ where: { id: value(form, "id") }, data: { status: "IGNORED", processedAt: new Date() } });
  revalidatePath("/admin/events/pending");
  redirect("/admin/events/pending");
}

export async function saveSourceAction(form: FormData) {
  const prisma = writableAdmin();
  const name = value(form, "name");
  const type = value(form, "type");
  const baseUrl = value(form, "baseUrl");
  const enabled = form.get("enabled") === "on";
  const crawlDepth = Number(value(form, "crawlDepth") || 2);
  const maxPagesPerRun = Number(value(form, "maxPagesPerRun") || 50);
  if (!name) throw new Error("Source name is required.");
  if (!["MANUAL", "API", "RSS", "WEB", "OTHER"].includes(type)) throw new Error("Select a supported source type.");
  if (["WEB", "API"].includes(type)) {
    try {
      const url = new URL(baseUrl);
      if (url.username || url.password || (type === "WEB" ? !["http:", "https:"].includes(url.protocol) : url.protocol !== "https:")) throw new Error();
    } catch { throw new Error(type === "WEB" ? "Website source must be a valid HTTP or HTTPS URL." : "API feed sources require a valid HTTPS URL."); }
  }
  if (type === "WEB" && (!Number.isInteger(crawlDepth) || crawlDepth < 1 || crawlDepth > 5)) throw new Error("Crawl depth must be between 1 and 5.");
  if (type === "WEB" && (!Number.isInteger(maxPagesPerRun) || maxPagesPerRun < 1 || maxPagesPerRun > 100)) throw new Error("Maximum pages per run must be between 1 and 100.");
  if (["RSS", "OTHER"].includes(type)) throw new Error("That source type is not implemented yet. Use WEB, API, or MANUAL.");
  if (type === "MANUAL" && baseUrl) throw new Error("Manual sources do not use a website URL.");
  await prisma.eventSource.create({ data: {
    name,
    slug: `${slugify(name)}-${Date.now().toString(36)}`,
    type: type as "MANUAL" | "API" | "WEB",
    baseUrl: baseUrl || null,
    enabled,
    crawlDepth: type === "WEB" ? crawlDepth : 2,
    maxPagesPerRun: type === "WEB" ? maxPagesPerRun : 50,
  } });
  revalidatePath("/admin/sources");
  redirect("/admin/sources");
}

export async function toggleSourceAction(form: FormData) {
  const prisma = writableAdmin();
  const id = value(form, "id");
  const source = await prisma.eventSource.findUniqueOrThrow({ where: { id } });
  await prisma.eventSource.update({ where: { id }, data: { enabled: !source.enabled } });
  revalidatePath("/admin/sources");
  redirect("/admin/sources");
}

export async function runSourceAction(form: FormData) {
  writableAdmin();
  const result = await runSource(value(form, "id"));
  revalidatePath("/admin/sources"); revalidatePath("/admin/events/pending"); revalidatePath("/admin");
  redirect(`/admin/sources?run=${result.status}`);
}

export async function resolveDuplicateAction(form: FormData) {
  const prisma = writableAdmin();
  const canonicalId = value(form, "canonicalId");
  const otherId = value(form, "otherId");
  const decision = value(form, "decision");
  if (canonicalId === otherId) throw new Error("An event cannot be merged into itself.");
  const pairKey = [canonicalId, otherId].sort().join(":");
  if (decision === "MERGE") {
    await prisma.$transaction(async (tx) => {
      const [canonical, other] = await Promise.all([
        tx.event.findUniqueOrThrow({ where: { id: canonicalId }, include: { distances: true } }),
        tx.event.findUniqueOrThrow({ where: { id: otherId }, include: { distances: true } }),
      ]);
      const otherRecords = await tx.eventSourceRecord.findMany({ where: { eventId: other.id } });
      for (const record of otherRecords) {
        const conflict = record.externalId ? await tx.eventSourceRecord.findUnique({ where: { sourceId_externalId: { sourceId: record.sourceId, externalId: record.externalId } } }) : null;
        const collision = conflict && conflict.id !== record.id;
        await tx.eventSourceRecord.update({ where: { id: record.id }, data: { eventId: canonical.id, ...(collision ? { externalId: `${record.externalId}#merged:${record.id}` } : {}) } });
      }
      await tx.rawEvent.updateMany({ where: { eventId: other.id }, data: { eventId: canonical.id } });
      const urls = [canonical.registrationUrl, other.registrationUrl].filter((url): url is string => Boolean(url));
      const websites = [canonical.officialWebsiteUrl, other.officialWebsiteUrl].filter((url): url is string => Boolean(url));
      const distances = mergeDistances(canonical.distances, other.distances);
      if (distances.length) await tx.eventDistance.createMany({ data: distances.map(({ name, discipline, distanceKm, sequence }) => ({ eventId: canonical.id, name, discipline, distanceKm, sequence })) });
      const details = mergeEventDetails(canonical, other);
      await tx.event.update({ where: { id: canonical.id }, data: {
        registrationUrl: details.registrationUrl ?? urls[0] ?? null,
        officialWebsiteUrl: details.officialWebsiteUrl ?? websites[0] ?? null,
        sourceName: details.sourceName,
        sourceUrl: details.sourceUrl,
        description: details.description,
        updatedAt: new Date(),
      } });
      await tx.event.delete({ where: { id: other.id } });
    });
  } else if (decision === "SEPARATE") {
    const event = await prisma.event.findUniqueOrThrow({ where: { id: otherId }, include: { city: true } });
    await prisma.event.update({ where: { id: otherId }, data: { duplicateKey: `${eventDuplicateKey({ name: event.name, startDate: event.startDate.toISOString(), city: event.city.name })}|separate|${otherId}` } });
    await prisma.duplicatePairDecision.upsert({ where: { pairKey }, update: { decision: "KEEP_SEPARATE" }, create: { pairKey, decision: "KEEP_SEPARATE" } });
  } else if (decision === "IGNORE") {
    await prisma.event.update({ where: { id: otherId }, data: { duplicateKey: null } });
    await prisma.duplicatePairDecision.upsert({ where: { pairKey }, update: { decision: "IGNORED" }, create: { pairKey, decision: "IGNORED" } });
  }
  revalidatePath("/admin/duplicates"); revalidatePath("/admin");
  redirect("/admin/duplicates");
}

export async function updateCityAliasAction(form: FormData) {
  const prisma = writableAdmin();
  const alias = value(form, "alias");
  const cityId = value(form, "cityId");
  if (alias && cityId) { const normalizedAlias = normalizeText(alias); await prisma.cityAlias.upsert({ where: { alias: normalizedAlias }, update: { cityId }, create: { alias: normalizedAlias, cityId } }); }
  revalidatePath("/admin");
  redirect("/admin");
}
