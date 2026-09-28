import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { EventFiltersForm } from "@/components/event-filters";
import { listEvents } from "@/lib/events";

export default async function HomePage() {
  const events = (await listEvents()).slice(0, 6);
  return <main><section style={{ background: "#eaf4ed", borderBottom: "1px solid #dceade" }}><div className="container" style={{ paddingBlock: "76px 52px" }}><div className="eyebrow">India&apos;s endurance event calendar</div><h1 style={{ fontSize: "clamp(38px,6vw,66px)", letterSpacing: "-.06em", lineHeight: 1.02, maxWidth: 760, margin: "18px 0" }}>Find your next race in India.</h1><p style={{ color: "#586b60", fontSize: 18, maxWidth: 650, lineHeight: 1.6, margin: "0 0 30px" }}>Discover marathons, ultras, triathlons, cycling events, HYROX, duathlons, hybrid races and more.</p><EventFiltersForm /></div></section>
    <section className="container" style={{ paddingTop: 54 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 20 }}><div><div className="eyebrow">Make a date with the start line</div><h2 style={{ fontSize: 30, letterSpacing: "-.04em", margin: "7px 0 0" }}>Upcoming Events</h2></div><Link href="/events" style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>All events →</Link></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 16 }}>{events.map((event) => <EventCard key={event.id} event={event} />)}</div></section>
    <section className="container" style={{ paddingTop: 58 }}><div style={{ background: "#173d2b", color: "white", borderRadius: 18, padding: 28, display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "center" }}><div><div style={{ opacity: .72, fontSize: 13 }}>Built for every distance and every pace</div><h2 style={{ fontSize: 25, margin: "8px 0 0" }}>Your next finish line is out there.</h2></div><Link className="button" href="/cities" style={{ background: "#fff", color: "#173d2b" }}>Explore by city</Link></div></section></main>;
}
