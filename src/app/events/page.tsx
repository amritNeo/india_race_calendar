import type { Metadata } from "next";
import { EventCard } from "@/components/event-card";
import { EventFiltersForm } from "@/components/event-filters";
import { listEvents } from "@/lib/events";
import type { EventFilters } from "@/lib/domain";

export const metadata: Metadata = { title: "Upcoming events", description: "Browse and filter upcoming endurance events across India.", alternates: { canonical: "/events" } };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters: EventFilters = Object.fromEntries(Object.entries(params).flatMap(([key, value]) => typeof value === "string" && value ? [[key, value]] : []));
  const events = await listEvents(filters);
  return <main className="container" style={{ paddingTop: 46 }}><div className="eyebrow">The race calendar</div><h1 style={{ fontSize: 42, letterSpacing: "-.05em", margin: "8px 0 22px" }}>Upcoming events</h1><EventFiltersForm filters={filters} /><p style={{ color: "var(--muted)", fontSize: 14, margin: "20px 0" }}>{events.length} {events.length === 1 ? "event" : "events"} found</p>{events.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 16 }}>{events.map((event) => <EventCard key={event.id} event={event} />)}</div> : <div style={{ background: "white", border: "1px solid var(--line)", borderRadius: 14, padding: 32, color: "var(--muted)" }}>No events match these filters. Try changing your city, category or dates.</div>}</main>;
}
