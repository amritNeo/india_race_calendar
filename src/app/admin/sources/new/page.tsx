import Link from "next/link";
import { saveSourceAction } from "@/app/admin/actions";

export default function NewSourcePage() {
  return (
    <>
      <p><Link href="/admin/sources">← Event sources</Link></p>
      <h1>Add event source</h1>
      <p style={{ color: "var(--muted)" }}>
        Website sources crawl public pages only. The crawler checks robots.txt, stays on the configured host, and sends every discovered event to pending review.
      </p>
      <form action={saveSourceAction} style={formStyle}>
        <label>
          Source name
          <input name="name" required maxLength={100} placeholder="India Running" style={fieldStyle} />
        </label>
        <label>
          Website URL or API feed URL
          <input name="baseUrl" type="url" required placeholder="https://example.org/" style={fieldStyle} />
        </label>
        <label>
          Source type
          <select name="type" defaultValue="WEB" style={fieldStyle}>
            <option value="WEB">WEB · public website crawler</option>
            <option value="API">API · public JSON feed</option>
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label>
            Crawl depth (1–5)
            <input name="crawlDepth" type="number" min={1} max={5} defaultValue={2} style={fieldStyle} />
          </label>
          <label>
            Maximum pages per run (1–100)
            <input name="maxPagesPerRun" type="number" min={1} max={100} defaultValue={50} style={fieldStyle} />
          </label>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input name="enabled" type="checkbox" defaultChecked /> Enable source
        </label>
        <button className="button" type="submit">Save source</button>
      </form>
    </>
  );
}

const formStyle = {
  display: "grid",
  gap: 14,
  padding: 18,
  border: "1px solid var(--line)",
  borderRadius: 10,
  background: "white",
} as const;

const fieldStyle = {
  display: "block",
  width: "100%",
  padding: 10,
  marginTop: 5,
  border: "1px solid var(--line)",
  borderRadius: 7,
} as const;
