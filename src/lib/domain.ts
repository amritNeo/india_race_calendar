export type DemoDistance = { name: string; discipline: "RUN" | "BIKE" | "SWIM" | "WALK" | "OTHER"; distanceKm: number | null; sequence: number };
export type DemoEvent = {
  id: string; name: string; slug: string; description: string; startDate: string; endDate: string | null;
  status: string; isDemo: boolean; city: { name: string; slug: string; state: { name: string; slug: string } };
  category: { name: string; slug: string; parent: { name: string; slug: string } | null };
  venue: { name: string; address: string | null } | null; organizer: { name: string; websiteUrl: string | null } | null;
  distances: DemoDistance[]; registrationUrl: string | null; officialWebsiteUrl: string | null;
  sourceName: string | null; sourceUrl: string | null; lastVerifiedAt: string | null; updatedAt: string;
};

export function slugify(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export type EventFilters = { city?: string; state?: string; category?: string; from?: string; to?: string; search?: string; status?: string; distance?: string };

export function filterEvents(events: DemoEvent[], filters: EventFilters): DemoEvent[] {
  return events.filter((event) => {
    const date = event.startDate.slice(0, 10);
    const search = filters.search?.trim().toLowerCase();
    return (!filters.city || event.city.slug === filters.city.toLowerCase())
      && (!filters.state || event.city.state.slug === filters.state.toLowerCase())
      && (!filters.category || event.category.slug === filters.category.toLowerCase() || event.category.parent?.slug === filters.category.toLowerCase())
      && (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to)
      && (!filters.status || event.status === filters.status)
      && (!filters.distance || event.distances.some((item) => item.distanceKm !== null && item.distanceKm >= Number(filters.distance)))
      && (!search || `${event.name} ${event.description} ${event.city.name} ${event.category.name} ${event.organizer?.name ?? ""}`.toLowerCase().includes(search));
  }).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function validateEvent(input: { name?: string; cityId?: string; categoryId?: string; startDate?: string; endDate?: string; registrationUrl?: string; officialWebsiteUrl?: string; sourceUrl?: string; distances?: { distanceKm?: number | null }[] }): string[] {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push("Event name is required.");
  if (!input.cityId) errors.push("City is required.");
  if (!input.categoryId) errors.push("Category is required.");
  const validDate = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value);
  if (!validDate(input.startDate)) errors.push("A valid start date is required.");
  if (input.endDate && !validDate(input.endDate)) errors.push("A valid end date is required.");
  if (input.endDate && input.startDate && validDate(input.startDate) && validDate(input.endDate) && Date.parse(input.endDate) < Date.parse(input.startDate)) errors.push("End date cannot be before start date.");
  for (const [label, value] of [["Registration URL", input.registrationUrl], ["Official website URL", input.officialWebsiteUrl], ["Source URL", input.sourceUrl]] as const) {
    if (value) { try { const url = new URL(value); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); } catch { errors.push(`${label} must be a valid HTTP or HTTPS URL.`); } }
  }
  if (input.distances?.some((distance) => distance.distanceKm != null && (!Number.isFinite(distance.distanceKm) || distance.distanceKm < 0))) errors.push("Distance must be zero or greater.");
  return errors;
}
