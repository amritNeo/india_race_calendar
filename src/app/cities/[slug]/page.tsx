import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventCard } from "@/components/event-card";
import { getCities, getCity, listEvents } from "@/lib/events";
type Props = { params: Promise<{ slug: string }> };
export async function generateStaticParams() { return (await getCities()).map((city) => ({ slug: city.slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = await getCity((await params).slug);
  return city ? { title: `Endurance events in ${city.name}`, description: `Upcoming marathons, running, cycling, triathlon and fitness events in ${city.name}, ${city.state.name}.`, alternates: { canonical: `/cities/${city.slug}` }, openGraph: { title: `Events in ${city.name}`, description: `Find your next race in ${city.name}.` } } : { title: "City not found" };
}
export default async function CityPage({ params }: Props) {
  const city = await getCity((await params).slug);
  if (!city) notFound();
  const events = await listEvents({ city: city.slug });
  return <main className="container" style={{ paddingTop: 46 }}><div className="eyebrow">{city.state.name}, India</div><h1 style={{ fontSize: 42, letterSpacing: "-.05em", margin: "8px 0" }}>Endurance events in {city.name}</h1><p style={{ color: "var(--muted)", margin: "0 0 24px" }}>Upcoming races and fitness events around {city.name}.</p>{events.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 16 }}>{events.map((event) => <EventCard key={event.id} event={event} />)}</div> : <p>No events listed yet for {city.name}.</p>}</main>;
}
