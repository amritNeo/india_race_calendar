import { demoCategories, demoCities, demoEvents } from "./demo-data";
import { filterEvents, type DemoEvent, type EventFilters } from "./domain";
import { getPrisma } from "./db";

export async function listEvents(filters: EventFilters = {}): Promise<DemoEvent[]> {
  const normalizedFilters = {
    ...filters,
    from: isDateOnly(filters.from) ? filters.from : undefined,
    to: isDateOnly(filters.to) ? filters.to : undefined,
  };
  const prisma = getPrisma();
  if (!prisma) return filterEvents(demoEvents, normalizedFilters);
  const statuses = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SOLD_OUT", "POSTPONED", "CANCELLED", "COMPLETED"] as const;
  const requestedStatus = statuses.find((status) => status === normalizedFilters.status);
  const rows = await prisma.event.findMany({
    where: {
      status: requestedStatus ?? { in: ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SOLD_OUT", "POSTPONED"] },
      ...(normalizedFilters.city || normalizedFilters.state ? { city: { ...(normalizedFilters.city ? { slug: normalizedFilters.city.toLowerCase() } : {}), ...(normalizedFilters.state ? { state: { slug: normalizedFilters.state.toLowerCase() } } : {}) } } : {}),
      ...(normalizedFilters.category ? { category: { OR: [{ slug: normalizedFilters.category.toLowerCase() }, { parent: { slug: normalizedFilters.category.toLowerCase() } }] } } : {}),
      ...(normalizedFilters.from || normalizedFilters.to ? { startDate: { ...(normalizedFilters.from ? { gte: new Date(`${normalizedFilters.from}T00:00:00.000Z`) } : {}), ...(normalizedFilters.to ? { lte: new Date(`${normalizedFilters.to}T23:59:59.999Z`) } : {}) } } : {}),
      ...(normalizedFilters.search ? { OR: [{ name: { contains: normalizedFilters.search, mode: "insensitive" } }, { description: { contains: normalizedFilters.search, mode: "insensitive" } }] } : {}),
      ...(normalizedFilters.distance && Number.isFinite(Number(normalizedFilters.distance)) && Number(normalizedFilters.distance) >= 0 ? { distances: { some: { distanceKm: { gte: Number(normalizedFilters.distance) } } } } : {}),
    },
    include: { city: { include: { state: true } }, category: { include: { parent: true } }, venue: true, organizer: true, distances: { orderBy: { sequence: "asc" } } },
    orderBy: { startDate: "asc" }, take: 60,
  });
  return rows.map(normalizeEvent);
}

function isDateOnly(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function normalizeEvent(row: Record<string, unknown>): DemoEvent {
  const event = row as unknown as Omit<DemoEvent, "startDate" | "endDate" | "updatedAt" | "lastVerifiedAt" | "distances"> & {
    startDate: Date | string; endDate: Date | string | null; updatedAt: Date | string; lastVerifiedAt: Date | string | null;
    distances: { name: string; discipline: DemoEvent["distances"][number]["discipline"]; distanceKm: number | { toNumber(): number } | null; sequence: number }[];
  };
  return { ...event, startDate: new Date(event.startDate).toISOString(), endDate: event.endDate ? new Date(event.endDate).toISOString() : null, updatedAt: new Date(event.updatedAt).toISOString(), lastVerifiedAt: event.lastVerifiedAt ? new Date(event.lastVerifiedAt).toISOString() : null, distances: event.distances.map((item) => ({ ...item, distanceKm: item.distanceKm === null ? null : typeof item.distanceKm === "number" ? item.distanceKm : item.distanceKm.toNumber() })) };
}

export async function getEvent(slug: string): Promise<DemoEvent | null> {
  const prisma = getPrisma();
  if (!prisma) return demoEvents.find((event) => event.slug === slug) ?? null;
  const row = await prisma.event.findUnique({ where: { slug }, include: { city: { include: { state: true } }, category: { include: { parent: true } }, venue: true, organizer: true, distances: { orderBy: { sequence: "asc" } } } });
  if (!row || row.status === "DRAFT") return null;
  return normalizeEvent(row as unknown as Record<string, unknown>);
}

export async function getCities() {
  const prisma = getPrisma();
  return prisma ? prisma.city.findMany({ include: { state: true }, orderBy: { name: "asc" } }) : demoCities;
}
export async function getCategories() {
  const prisma = getPrisma();
  return prisma ? prisma.eventCategory.findMany({ include: { parent: true }, orderBy: [{ parentId: "asc" }, { name: "asc" }] }) : demoCategories;
}
export async function getCity(slug: string) {
  const cities = await getCities();
  return cities.find((city) => city.slug === slug) ?? null;
}
export async function getCategory(slug: string) {
  const categories = await getCategories();
  const exact = categories.find((category) => category.slug === slug);
  if (exact) return exact;
  const child = categories.find((category) => category.parent?.slug === slug);
  return child?.parent ?? null;
}

export function toPublicEvent(event: DemoEvent) {
  return {
    name: event.name, slug: event.slug, description: event.description, startDate: event.startDate, endDate: event.endDate,
    status: event.status, isDemo: event.isDemo,
    city: { name: event.city.name, slug: event.city.slug, state: { name: event.city.state.name, slug: event.city.state.slug } },
    category: { name: event.category.name, slug: event.category.slug, parent: event.category.parent },
    venue: event.venue ? { name: event.venue.name, address: event.venue.address } : null,
    organizer: event.organizer ? { name: event.organizer.name, websiteUrl: event.organizer.websiteUrl } : null,
    distances: event.distances.map(({ name, discipline, distanceKm, sequence }) => ({ name, discipline, distanceKm, sequence })),
    registrationUrl: event.registrationUrl, officialWebsiteUrl: event.officialWebsiteUrl,
    sourceName: event.sourceName, sourceUrl: event.sourceUrl, lastVerifiedAt: event.lastVerifiedAt, updatedAt: event.updatedAt,
  };
}
