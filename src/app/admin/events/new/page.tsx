import { getPrisma } from "@/lib/db";
import { AdminEventForm } from "@/components/admin-event-form";
import { normalizeCategory, splitLocation } from "@/lib/ingestion/normalization";
import { slugify } from "@/lib/domain";

export default async function NewAdminEventPage({ searchParams }: { searchParams: Promise<{ raw?: string }> }) {
  const prisma = getPrisma();
  if (!prisma) return <p>Manual entry requires a configured database.</p>;
  const rawId = (await searchParams).raw;
  const [cities, categories, sources, raw] = await Promise.all([
    prisma.city.findMany({ include: { state: true }, orderBy: { name: "asc" } }),
    prisma.eventCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.eventSource.findMany({ orderBy: { name: "asc" } }),
    rawId ? prisma.rawEvent.findUnique({ where: { id: rawId }, include: { source: true } }) : null,
  ]);
  const payload = raw?.rawPayload && typeof raw.rawPayload === "object" && !Array.isArray(raw.rawPayload) ? raw.rawPayload as Record<string, unknown> : {};
  const text = (key: string) => typeof payload[key] === "string" ? payload[key] as string : "";
  const location = splitLocation(text("city") || text("location"));
  const city = await prisma.city.findFirst({ where: { OR: [{ slug: slugify(location.city) }, { name: { equals: location.city, mode: "insensitive" } }] } });
  const category = await prisma.eventCategory.findUnique({ where: { slug: normalizeCategory(text("category")) } });
  const initial = raw ? {
    name: text("name") || text("title"), description: text("description"), startDate: (text("startDate") || text("date")).slice(0, 10), endDate: text("endDate").slice(0, 10),
    cityId: city?.id ?? "", categoryId: category?.id ?? "", registrationUrl: text("registrationUrl"), officialWebsiteUrl: text("officialWebsiteUrl"),
    sourceName: raw.source.name, sourceUrl: raw.sourceUrl ?? text("sourceUrl"), venue: text("venue"), organizer: text("organizer"),
  } : undefined;
  return <><h1>New event</h1><AdminEventForm cities={cities} categories={categories} sources={sources} rawId={raw?.id} initialSourceId={raw?.sourceId} initialExternalId={raw ? raw.externalId ?? `fp:${raw.contentHash}` : undefined} initial={initial} rawPayload={raw?.rawPayload} /></>;
}
