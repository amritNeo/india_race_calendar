import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { AdminEventForm } from "@/components/admin-event-form";
import { approveEventAction, rejectEventAction } from "@/app/admin/actions";

export default async function AdminEventDetail({ params }: { params: Promise<{ id: string }> }) {
  const prisma = getPrisma();
  if (!prisma) return <p>Connect a database to review events.</p>;
  const id = (await params).id;
  const event = await prisma.event.findUnique({ where: { id }, include: { venue: true, organizer: true, distances: { orderBy: { sequence: "asc" } }, sourceRecords: { orderBy: { createdAt: "asc" } }, rawEvents: { orderBy: { discoveredAt: "desc" }, take: 1 } } });
  if (!event) notFound();
  const [cities, categories, sources] = await Promise.all([prisma.city.findMany({ include: { state: true }, orderBy: { name: "asc" } }), prisma.eventCategory.findMany({ orderBy: { name: "asc" } }), prisma.eventSource.findMany({ orderBy: { name: "asc" } })]);
  return <><h1>Review event</h1><AdminEventForm event={event} cities={cities} categories={categories} sources={sources} initialSourceId={event.sourceRecords[0]?.sourceId} initialExternalId={event.sourceRecords[0]?.externalId ?? undefined} rawPayload={event.rawEvents[0]?.rawPayload} />
    <div style={{ display: "flex", gap: 12, marginTop: 16 }}><form action={approveEventAction}><input type="hidden" name="id" value={event.id} /><button className="button" type="submit">Approve and publish</button></form><form action={rejectEventAction}><input type="hidden" name="id" value={event.id} /><button type="submit" style={{ padding: 10 }}>Reject</button></form></div>
  </>;
}
