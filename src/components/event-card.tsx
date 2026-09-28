import Link from "next/link";
import type { DemoEvent } from "@/lib/domain";

const date = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
export function EventCard({ event }: { event: DemoEvent }) {
  return <article style={{ padding: 22, background: "white", border: "1px solid var(--line)", borderRadius: 14, display: "flex", flexDirection: "column", minHeight: 230 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><span className="pill">{event.category.name}</span>{event.isDemo && <span className="pill" style={{ background: "#fff3d6", color: "#79520b" }}>Sample</span>}</div><span style={{ fontSize: 12, fontWeight: 700, color: event.status === "REGISTRATION_OPEN" ? "#16734b" : "#68766e" }}>{event.status.replaceAll("_", " ")}</span></div>
    <h2 style={{ fontSize: 19, lineHeight: 1.3, letterSpacing: "-.025em", margin: "16px 0 8px" }}><Link href={`/events/${event.slug}`}>{event.name}</Link></h2>
    <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 5px" }}>{date(event.startDate)} · {event.city.name}, {event.city.state.name}</p>
    {event.venue && <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>{event.venue.name}</p>}
    <p style={{ color: "#42534a", fontSize: 13, margin: "auto 0 15px", lineHeight: 1.6 }}>{event.distances.map((distance) => distance.name).join(" · ")}{event.organizer ? ` · ${event.organizer.name}` : ""}</p>
    <Link className="button" href={`/events/${event.slug}`} style={{ alignSelf: "flex-start", background: "#edf5ef", color: "var(--green)" }}>View event <span aria-hidden="true" style={{ marginLeft: 8 }}>→</span></Link>
  </article>;
}
