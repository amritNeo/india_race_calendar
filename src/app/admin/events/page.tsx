import Link from "next/link";
import { getPrisma } from "@/lib/db";

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const prisma = getPrisma();
  if (!prisma) return <p>Connect a database to manage events.</p>;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [events, total] = await Promise.all([prisma.event.findMany({ skip: (page - 1) * 50, take: 50, orderBy: { updatedAt: "desc" }, include: { city: true, category: true } }), prisma.event.count()]);
  return <><h1>Events</h1><p>{total} records · Page {page}</p><p><Link href="/admin/events/new">Create event</Link></p>
    <div style={{ display: "grid", gap: 10 }}>{events.map((event) => <Link key={event.id} href={`/admin/events/${event.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: 14, border: "1px solid var(--line)", borderRadius: 10, background: "white", textDecoration: "none", color: "inherit" }}><span><strong>{event.name}</strong><br /><small>{event.startDate.toLocaleDateString("en-IN")} · {event.city.name} · {event.category.name}</small></span><span>{event.status}</span></Link>)}</div>
    <div style={{ display: "flex", gap: 14, marginTop: 20 }}>{page > 1 && <Link href={`/admin/events?page=${page - 1}`}>← Previous</Link>}{page * 50 < total && <Link href={`/admin/events?page=${page + 1}`}>Next →</Link>}</div>
  </>;
}
