import { slugify, validateEvent } from "@/lib/domain";
import type { NormalizedEvent, RawEvent } from "./types";

export function normalizeText(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function splitLocation(value: string): { city: string; state?: string } {
  const [city, ...stateParts] = value.split(",").map((part) => part.trim()).filter(Boolean);
  return { city: city ?? "", ...(stateParts.length ? { state: stateParts.join(", ") } : {}) };
}

export function normalizeCategory(value: string): string {
  const key = normalizeText(value).replace(/\s/g, "");
  if (["21k", "211k", "21km", "211km", "hm", "halfmarathon"].includes(key)) return "half-marathon";
  if (["42k", "42195k", "42km", "42195km", "marathon"].includes(key)) return "marathon";
  if (["703", "703triathlon", "triathlon703", "triathlon"].includes(key)) return "triathlon";
  return slugify(value);
}

export function fallbackExternalId(event: { name: string; startDate: string; city: string; sourceSlug: string }): string {
  const stable = `${normalizeText(event.name)}|${event.startDate.slice(0, 10)}|${normalizeText(event.city)}|${event.sourceSlug}`;
  return `fp:${stable}`;
}

export function eventDuplicateKey(event: { name: string; startDate: string; city: string }): string {
  const date = new Date(event.startDate);
  const datePart = Number.isNaN(date.valueOf()) ? event.startDate : date.toISOString().slice(0, 10);
  return [normalizeText(event.name), datePart, normalizeText(event.city)].join("|");
}

export function validateNormalizedEvent(event: NormalizedEvent, refs: { cityId?: string; categoryId?: string }, sourceUrl?: string): string[] {
  return validateEvent({
    name: event.name,
    cityId: refs.cityId,
    categoryId: refs.categoryId,
    startDate: event.startDate,
    endDate: event.endDate ?? undefined,
    registrationUrl: event.registrationUrl,
    officialWebsiteUrl: event.officialWebsiteUrl,
    sourceUrl,
    distances: event.distances,
  });
}

export function normalizeFeedEvent(raw: RawEvent): NormalizedEvent {
  const getString = (key: string) => typeof raw[key] === "string" ? (raw[key] as string).trim() : "";
  const dateOnly = (value: string) => {
    const prefix = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (prefix) return prefix;
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? value : date.toISOString().slice(0, 10);
  };
  const city = getString("city");
  const category = getString("category");
  const startDate = getString("startDate") || getString("date");
  const endDate = getString("endDate");
  return {
    name: getString("name") || getString("title"),
    description: getString("description"),
    startDate: dateOnly(startDate),
    endDate: endDate ? dateOnly(endDate) : null,
    city,
    category: normalizeCategory(category),
    venue: getString("venue") || undefined,
    organizer: getString("organizer") || undefined,
    registrationUrl: getString("registrationUrl") || undefined,
    officialWebsiteUrl: getString("officialWebsiteUrl") || undefined,
    distances: Array.isArray(raw.distances) ? raw.distances.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const distance = item as Record<string, unknown>;
      return [{ name: typeof distance.name === "string" ? distance.name : "", distanceKm: typeof distance.distanceKm === "number" ? distance.distanceKm : null, discipline: typeof distance.discipline === "string" && ["RUN", "BIKE", "SWIM", "WALK", "ROW", "OTHER"].includes(distance.discipline) ? distance.discipline as NonNullable<NormalizedEvent["distances"]>[number]["discipline"] : "OTHER" }];
    }) : [],
  };
}
