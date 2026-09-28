import { getPrisma } from "@/lib/db";
import { runSourceAction, saveSourceAction, toggleSourceAction } from "@/app/admin/actions";

export default async function AdminSourcesPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const prisma = getPrisma();
  if (!prisma) return <p>Connect a database to manage ingestion sources.</p>;
  const sources = await prisma.eventSource.findMany({ orderBy: { name: "asc" }, include: { runs: { take: 10, orderBy: { startedAt: "desc" } } } });
  const runNotice = (await searchParams).run;
  return <><h1>Event sources</h1>{runNotice && <p>Source run finished: {runNotice}.</p>}
    {sources.map((source) => <article key={source.id} style={card}><div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}><div><strong>{source.name}</strong> · {source.type}<div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{source.baseUrl ?? "No feed URL"}</div><div style={{ fontSize: 13, marginTop: 4 }}>Enabled: {source.enabled ? "Yes" : "No"} · Last run: {source.lastRunAt?.toLocaleString("en-IN") ?? "Never"} · Last success: {source.lastSuccessAt?.toLocaleString("en-IN") ?? "Never"} · Last error: {source.lastErrorAt?.toLocaleString("en-IN") ?? "Never"}</div></div>
      <div style={{ display: "flex", gap: 8, alignItems: "start" }}><form action={toggleSourceAction}><input type="hidden" name="id" value={source.id} /><button type="submit">{source.enabled ? "Disable" : "Enable"}</button></form>{source.type !== "MANUAL" && <form action={runSourceAction}><input type="hidden" name="id" value={source.id} /><button className="button" type="submit" disabled={!source.enabled}>Run now</button></form>}</div></div>
      {source.runs.length > 0 && <details style={{ marginTop: 10 }}><summary>Run history</summary><ul>{source.runs.map((run) => <li key={run.id}>{run.startedAt.toLocaleString("en-IN")} · {run.status} · discovered {run.recordsDiscovered}, new {run.recordsCreated}, updated {run.recordsUpdated}, rejected {run.recordsRejected}, duplicates {run.duplicatesFound}{run.errorMessage && ` · ${run.errorMessage}`}</li>)}</ul></details>}
    </article>)}
    <h2 style={{ marginTop: 32 }}>Add a source</h2><p>WEB and API sources are treated as public HTTPS JSON feeds. The feed must return an array or an object with an <code>events</code> array. Only add endpoints you are authorized to access and that permit automated requests.</p>
    <form action={saveSourceAction} style={formStyle}><label>Name<input name="name" required style={fieldStyle} /></label><label>Type<select name="type" style={fieldStyle}><option value="WEB">WEB · public JSON feed</option><option value="API">API · public JSON feed</option><option value="MANUAL">MANUAL</option><option value="RSS">RSS · not yet supported</option><option value="OTHER">OTHER · not yet supported</option></select></label><label>Feed URL (HTTPS)<input name="baseUrl" type="url" style={fieldStyle} /></label><button className="button">Add source</button></form>
  </>;
}
const card = { padding: 16, border: "1px solid var(--line)", borderRadius: 10, background: "white", margin: "12px 0" } as const;
const formStyle = { display: "grid", gap: 12, padding: 18, border: "1px solid var(--line)", borderRadius: 10, background: "white" } as const;
const fieldStyle = { display: "block", width: "100%", padding: 10, marginTop: 5, border: "1px solid var(--line)", borderRadius: 7 } as const;
