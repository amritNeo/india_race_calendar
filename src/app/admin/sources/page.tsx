import { getPrisma } from "@/lib/db";
import Link from "next/link";
import { runSourceAction, toggleSourceAction } from "@/app/admin/actions";

export default async function AdminSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const prisma = getPrisma();
  if (!prisma) return <p>Connect a database to manage ingestion sources.</p>;
  const sources = await prisma.eventSource.findMany({
    orderBy: { name: "asc" },
    include: { runs: { take: 10, orderBy: { startedAt: "desc" } } },
  });
  const runNotice = (await searchParams).run;
  return (
    <>
      <h1>Event sources</h1>
      {runNotice && <p>Source run finished: {runNotice}.</p>}
      <p><Link className="button" href="/admin/sources/new">Add source</Link></p>
      {sources.map((source) => (
        <article key={source.id} style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <strong>{source.name}</strong> · {source.type}
              <div
                style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}
              >
                {source.baseUrl ?? "No feed URL"}
              </div>
              {source.type === "WEB" && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Crawl depth: {source.crawlDepth} · Max pages per run: {source.maxPagesPerRun}</div>}
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Enabled: {source.enabled ? "Yes" : "No"} · Last run:{" "}
                {source.lastRunAt?.toLocaleString("en-IN") ?? "Never"} · Last
                success:{" "}
                {source.lastSuccessAt?.toLocaleString("en-IN") ?? "Never"} ·
                Last error:{" "}
                {source.lastErrorAt?.toLocaleString("en-IN") ?? "Never"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "start" }}>
              <form action={toggleSourceAction}>
                <input type="hidden" name="id" value={source.id} />
                <button type="submit">
                  {source.enabled ? "Disable" : "Enable"}
                </button>
              </form>
              {source.type !== "MANUAL" && (
                <form action={runSourceAction}>
                  <input type="hidden" name="id" value={source.id} />
                  <button
                    className="button"
                    type="submit"
                    disabled={!source.enabled}
                  >
                    Run now
                  </button>
                </form>
              )}
            </div>
          </div>
          {source.runs.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary>Run history</summary>
              <ul>
                {source.runs.map((run) => (
                  <li key={run.id}>
                    {run.startedAt.toLocaleString("en-IN")} · {run.status} ·
                    discovered {run.recordsDiscovered}, new {run.recordsCreated}
                    , updated {run.recordsUpdated}, rejected{" "}
                    {run.recordsRejected}, duplicates {run.duplicatesFound}
                    {run.robotsStatus && ` · robots.txt ${run.robotsStatus}`}
                    {run.robotsReason && ` · ${run.robotsReason}`}
                    {run.errorMessage && ` · ${run.errorMessage}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </article>
      ))}
    </>
  );
}
const card = {
  padding: 16,
  border: "1px solid var(--line)",
  borderRadius: 10,
  background: "white",
  margin: "12px 0",
} as const;
