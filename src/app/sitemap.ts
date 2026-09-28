import type { MetadataRoute } from "next";
import { getCategories, getCities, listEvents } from "@/lib/events";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.PUB_SI_URL ?? "http://localhost:3000";
  const [cities, categories, events] = await Promise.all([
    getCities(),
    getCategories(),
    listEvents(),
  ]);
  const paths = new Set([
    "",
    "/events",
    "/cities",
    "/about",
    ...cities.map((city) => `/cities/${city.slug}`),
    ...categories.flatMap((category) => [
      `/categories/${category.slug}`,
      ...(category.parent ? [`/categories/${category.parent.slug}`] : []),
    ]),
    ...events.map((event) => `/events/${event.slug}`),
  ]);
  return [...paths].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
