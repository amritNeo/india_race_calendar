import Link from "next/link";
import { getPrisma } from "@/lib/db";
import { ignoreRawEventAction } from "@/app/admin/actions";

export default async function PendingEventsPage() {
  const prisma = getPrisma();
  if (!prisma) return <p>Connect a database to review ingested events.</p>;
  const [events, raw] = await Promise.all([
    prisma.event.findMany({ where: { status: "PENDING_REVIEW" }, take: 100, orderBy: { createdAt: "desc" }, include: { city: true, category: true, sourceRecords: { include: { source: true } } } }),
    prisma.rawEvent.findMany({ where: { status: "FAILED" }, take: 100, orderBy: { discoveredAt: "desc" }, include: { source: true } }),
  ]);
  return <><h1>Pending review</h1><p>{events.length} normalized candidates and {raw.length} records needing normalization fixes.</p>
    <div style={{ display: "grid", gap: 12 }}>{events.map((event) => <article key={event.id} style={card}><strong>{event.name}</strong><div>{event.startDate.toLocaleDateString("en-IN")} · {event.city.name} · {event.category.name}</div><small>Source: {event.sourceRecords.map((record) => record.source.name).join(", ") || event.sourceName || "Manual"}</small><div style={{ marginTop: 8 }}><Link href={`/admin/events/${event.id}`}>Review and edit →</Link></div></article>)}{raw.map((record) => <article key={record.id} style={card}><strong>Needs normalization: {record.source.name}</strong><div>{record.sourceUrl ?? "No source URL"}</div><p>{record.errorMessage}</p><details><summary>Original source data</summary><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(record.rawPayload, null, 2)}</pre></details><div style={{ display: "flex", gap: 12 }}><Link href={`/admin/events/new?raw=${record.id}`}>Create normalized event →</Link><form action={ignoreRawEventAction}><input type="hidden" name="id" value={record.id} /><button type="submit">Ignore</button></form></div></article>)}</div>
    {!events.length && !raw.length && <p>No pending events.</p>}
  </>;
}
const card = { padding: 16, border: "1px solid var(--line)", borderRadius: 10, background: "white", display: "grid", gap: 6 } as const;
