import { getCategories, getCities } from "@/lib/events";
import type { EventFilters } from "@/lib/domain";

export async function EventFiltersForm({ filters = {} }: { filters?: EventFilters }) {
  const [cities, categories] = await Promise.all([getCities(), getCategories()]);
  const roots = [...new Map(categories.map((item) => [item.parent?.slug ?? item.slug, item.parent ?? item])).values()];
  const states = [...new Map(cities.map((city) => [city.state.slug, city.state])).values()].sort((a, b) => a.name.localeCompare(b.name));
  return <form action="/events" method="get" style={{ background: "white", padding: 18, border: "1px solid var(--line)", borderRadius: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12, alignItems: "end" }}>
    <label>City<select name="city" defaultValue={filters.city ?? ""}><option value="">All cities</option>{cities.map((city) => <option key={city.slug} value={city.slug}>{city.name}</option>)}</select></label>
    <label>State<select name="state" defaultValue={filters.state ?? ""}><option value="">All states</option>{states.map((state) => <option key={state.slug} value={state.slug}>{state.name}</option>)}</select></label>
    <label>Category<select name="category" defaultValue={filters.category ?? ""}><option value="">All categories</option>{roots.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}{categories.filter((category) => category.parent).map((category) => <option key={`child-${category.slug}`} value={category.slug}>↳ {category.name}</option>)}</select></label>
    <label>From<input name="from" type="date" defaultValue={filters.from} /></label><label>To<input name="to" type="date" defaultValue={filters.to} /></label>
    <label>Min distance (km)<input name="distance" type="number" min="0" step="1" placeholder="Any distance" defaultValue={filters.distance} /></label>
    <label>Search<input name="search" type="search" placeholder="Event or organizer" defaultValue={filters.search} /></label>
    <label>Status<select name="status" defaultValue={filters.status ?? ""}><option value="">Upcoming</option><option value="REGISTRATION_OPEN">Registration open</option><option value="REGISTRATION_CLOSED">Registration closed</option><option value="SOLD_OUT">Sold out</option><option value="POSTPONED">Postponed</option><option value="CANCELLED">Cancelled</option><option value="COMPLETED">Completed</option></select></label>
    <button className="button" type="submit">Find events</button>
  </form>;
}
