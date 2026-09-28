import Link from "next/link";
import { getPrisma } from "@/lib/db";

export default async function AdminPage() {
  const prisma = getPrisma();
  let pending = 0;
  let failedRaw = 0;
  let sources = 0;
  let duplicateGroups = 0;
  let recentRuns: { id: string; source: { name: string }; startedAt: Date; status: string; recordsDiscovered: number; recordsCreated: number; duplicatesFound: number }[] = [];
  if (prisma) {
    const [pendingCount, failedCount, sourceCount, keyedEvents, runs] = await Promise.all([
      prisma.event.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.rawEvent.count({ where: { status: "FAILED" } }),
      prisma.eventSource.count(),
      prisma.event.findMany({ where: { duplicateKey: { not: null } }, take: 2000, select: { duplicateKey: true } }),
      prisma.ingestionRun.findMany({ take: 5, orderBy: { startedAt: "desc" }, include: { source: true } }),
    ]);
    pending = pendingCount; failedRaw = failedCount; sources = sourceCount; recentRuns = runs;
    const keyCounts = new Map<string, number>();
    for (const row of keyedEvents) if (row.duplicateKey) keyCounts.set(row.duplicateKey, (keyCounts.get(row.duplicateKey) ?? 0) + 1);
    duplicateGroups = [...keyCounts.values()].filter((count) => count > 1).length;
  }
  return <><div className="eyebrow">Phase 2 · Data management</div><h1 style={{ fontSize: 40, letterSpacing: "-.05em", margin: "8px 0 26px" }}>Admin dashboard</h1>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 14 }}>
      {[["Pending events", String(pending), "/admin/events/pending"], ["Failed raw records", String(failedRaw), "/admin/events/pending"], ["Possible duplicate groups", String(duplicateGroups), "/admin/duplicates"], ["Sources", String(sources), "/admin/sources"]].map(([label, count, href]) => <Link key={label} href={href} style={{ padding: 20, border: "1px solid var(--line)", borderRadius: 14, background: "white", textDecoration: "none" }}><div style={{ color: "var(--muted)", fontSize: 13 }}>{label}</div><strong style={{ display: "block", marginTop: 8, fontSize: 30, color: "var(--ink)" }}>{count}</strong></Link>)}
    </div>
    <h2 style={{ marginTop: 36 }}>Recent ingestion runs</h2>
    {recentRuns.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}><thead><tr>{["Source", "Started", "Status", "Discovered", "New", "Duplicates"].map((title) => <th key={title} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--line)" }}>{title}</th>)}</tr></thead><tbody>{recentRuns.map((run) => <tr key={run.id}><td style={{ padding: 10 }}>{run.source.name}</td><td style={{ padding: 10 }}>{run.startedAt.toLocaleString("en-IN")}</td><td style={{ padding: 10 }}>{run.status}</td><td style={{ padding: 10 }}>{run.recordsDiscovered}</td><td style={{ padding: 10 }}>{run.recordsCreated}</td><td style={{ padding: 10 }}>{run.duplicatesFound}</td></tr>)}</tbody></table></div> : <p style={{ color: "var(--muted)" }}>No ingestion runs yet. Create and configure a source to begin.</p>}
  </>;
}
