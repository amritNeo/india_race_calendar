import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { categoryCatalog, demoEvents } from "../src/lib/demo-data";

config({ path: ".env.local" });
config({ path: ".env" });
const connectionString = process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL or DIRECT_URL is required to seed the database. Add the PostgreSQL connection strings to .env.local.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const country = await prisma.country.upsert({ where: { code: "IN" }, update: { name: "India" }, create: { code: "IN", name: "India" } });
  const states = new Map<string, string>();
  const cities = new Map<string, string>();
  for (const sample of demoEvents) {
    const stateKey = sample.city.state.slug;
    if (!states.has(stateKey)) {
      const state = await prisma.state.upsert({ where: { slug: stateKey }, update: { name: sample.city.state.name }, create: { slug: stateKey, name: sample.city.state.name, countryId: country.id } });
      states.set(stateKey, state.id);
    }
    if (!cities.has(sample.city.slug)) {
      const city = await prisma.city.upsert({ where: { slug: sample.city.slug }, update: { name: sample.city.name, stateId: states.get(stateKey)! }, create: { slug: sample.city.slug, name: sample.city.name, stateId: states.get(stateKey)! } });
      cities.set(sample.city.slug, city.id);
    }
  }

  const parents = new Map<string, string>();
  for (const [name, slug] of categoryCatalog.map(([name, slug]) => [name, slug] as const)) {
    const category = await prisma.eventCategory.upsert({ where: { slug }, update: { name }, create: { slug, name } });
    parents.set(slug, category.id);
  }
  const categories = new Map<string, string>();
  for (const [, parentSlug, children] of categoryCatalog) {
    for (const [name, slug] of children) {
      const category = await prisma.eventCategory.upsert({ where: { slug }, update: { name, parentId: parents.get(parentSlug)! }, create: { slug, name, parentId: parents.get(parentSlug)! } });
      categories.set(slug, category.id);
    }
  }

  const organizers = new Map<string, string>();
  for (const sample of demoEvents) {
    const organizerName = sample.organizer!.name;
    if (!organizers.has(organizerName)) {
      const organizer = await prisma.organizer.findFirst({ where: { name: organizerName } }) ?? await prisma.organizer.create({ data: { name: organizerName } });
      organizers.set(organizerName, organizer.id);
    }
  }

  for (const sample of demoEvents) {
    const venueName = sample.venue!.name;
    const venue = await prisma.venue.findFirst({ where: { name: venueName, cityId: cities.get(sample.city.slug)! } }) ?? await prisma.venue.create({ data: { name: venueName, cityId: cities.get(sample.city.slug)! } });
    const existing = await prisma.event.findUnique({ where: { slug: sample.slug } });
    const payload = {
      name: sample.name, description: sample.description, cityId: cities.get(sample.city.slug)!, categoryId: categories.get(sample.category.slug)!,
      organizerId: organizers.get(sample.organizer!.name)!, venueId: venue.id, startDate: new Date(sample.startDate),
      status: sample.status as "PUBLISHED" | "REGISTRATION_OPEN", isDemo: true,
      sourceName: "Development sample data", registrationUrl: null, officialWebsiteUrl: null, sourceUrl: null,
    };
    const event = existing ? await prisma.event.update({ where: { id: existing.id }, data: payload }) : await prisma.event.create({ data: { ...payload, slug: sample.slug } });
    await prisma.eventDistance.deleteMany({ where: { eventId: event.id } });
    await prisma.eventDistance.createMany({ data: sample.distances.map((distance) => ({ eventId: event.id, name: distance.name, discipline: distance.discipline, distanceKm: distance.distanceKm, sequence: distance.sequence })) });
  }
  console.log(`Seeded ${demoEvents.length} clearly marked sample events across 15 cities.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
