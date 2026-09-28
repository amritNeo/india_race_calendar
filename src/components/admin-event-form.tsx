import { saveEventAction } from "@/app/admin/actions";

type AdminEventFormData = {
  id: string; name: string; description: string; cityId: string; categoryId: string;
  startDate: Date; endDate: Date | null; registrationUrl: string | null; officialWebsiteUrl: string | null;
  sourceName: string | null; sourceUrl: string | null; status: string;
  venue: { name: string } | null; organizer: { name: string } | null;
  distances?: { name: string; distanceKm: number | { toNumber(): number } | null; discipline: string }[];
};

export function AdminEventForm({ cities, categories, sources, event, rawPayload, rawId, initialSourceId, initialExternalId, initial }: {
  cities: { id: string; name: string; state: { name: string } }[];
  categories: { id: string; name: string }[];
  sources: { id: string; name: string }[];
  event?: AdminEventFormData;
  rawPayload?: unknown;
  rawId?: string;
  initialSourceId?: string;
  initialExternalId?: string;
  initial?: Partial<{ name: string; description: string; startDate: string; endDate: string; cityId: string; categoryId: string; registrationUrl: string; officialWebsiteUrl: string; sourceName: string; sourceUrl: string; venue: string; organizer: string }>;
}) {
  const input = (label: string, name: string, value = "", type = "text", required = false) => <label style={{ display: "grid", gap: 5 }}>{label}<input name={name} type={type} defaultValue={value} required={required} style={fieldStyle} /></label>;
  const val = (date?: Date | null) => date ? date.toISOString().slice(0, 10) : "";
  const raw = rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? rawPayload as Record<string, unknown> : {};
  const rawText = (...keys: string[]) => { for (const key of keys) if (typeof raw[key] === "string") return raw[key] as string; return ""; };
  const originalSourceUrl = rawText("sourceUrl", "url");
  const safeSourceUrl = /^https?:\/\//i.test(originalSourceUrl) ? originalSourceUrl : "";
  return <form action={saveEventAction} style={{ display: "grid", gap: 14, padding: 18, border: "1px solid var(--line)", borderRadius: 12, background: "white" }}>
    {event && <input type="hidden" name="id" value={event.id} />}
    {rawId && <input type="hidden" name="rawId" value={rawId} />}
    {initialExternalId && <input type="hidden" name="externalId" value={initialExternalId} />}
    {rawPayload !== undefined && <section style={{ padding: 14, background: "#f5f7f5", borderRadius: 8 }}><h2 style={{ fontSize: 18, marginTop: 0 }}>Source data</h2><dl style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, margin: 0 }}><dt>Original title</dt><dd>{rawText("title", "name") || "Not supplied"}</dd><dt>Original date</dt><dd>{rawText("startDate", "date") || "Not supplied"}</dd><dt>Original location</dt><dd>{rawText("city", "location") || "Not supplied"}</dd><dt>Original description</dt><dd style={{ whiteSpace: "pre-wrap" }}>{rawText("description") || "Not supplied"}</dd><dt>Source URL</dt><dd>{safeSourceUrl ? <a href={safeSourceUrl} target="_blank" rel="noopener noreferrer">{safeSourceUrl}</a> : originalSourceUrl || "Not supplied"}</dd></dl><details style={{ marginTop: 10 }}><summary>Full raw payload</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(rawPayload, null, 2)}</pre></details></section>}
    {input("Event name", "name", event?.name ?? initial?.name, "text", true)}
    <label style={{ display: "grid", gap: 5 }}>Description<textarea name="description" defaultValue={event?.description ?? initial?.description ?? ""} rows={4} style={fieldStyle} /></label>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
      <label style={{ display: "grid", gap: 5 }}>Start date<input name="startDate" type="date" defaultValue={event ? val(event.startDate) : initial?.startDate ?? ""} required style={fieldStyle} /></label>
      <label style={{ display: "grid", gap: 5 }}>End date<input name="endDate" type="date" defaultValue={event ? val(event.endDate) : initial?.endDate ?? ""} style={fieldStyle} /></label>
      <label style={{ display: "grid", gap: 5 }}>Country<input value="India" readOnly style={{ ...fieldStyle, background: "#f5f7f5" }} /></label>
      <label style={{ display: "grid", gap: 5 }}>City<select name="cityId" defaultValue={event?.cityId ?? initial?.cityId ?? ""} required style={fieldStyle}><option value="">Choose city</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name} · {city.state.name}</option>)}</select></label>
      <label style={{ display: "grid", gap: 5 }}>Category<select name="categoryId" defaultValue={event?.categoryId ?? initial?.categoryId ?? ""} required style={fieldStyle}><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    </div>
    {input("Venue", "venue", event?.venue?.name ?? initial?.venue)}{input("Organizer", "organizer", event?.organizer?.name ?? initial?.organizer)}
    {input("Registration URL", "registrationUrl", event?.registrationUrl ?? initial?.registrationUrl, "url")}{input("Official website URL", "officialWebsiteUrl", event?.officialWebsiteUrl ?? initial?.officialWebsiteUrl, "url")}
    {input("Source label", "sourceName", event?.sourceName ?? initial?.sourceName ?? "Manual entry")}{input("Source URL", "sourceUrl", event?.sourceUrl ?? initial?.sourceUrl, "url")}
    {input("City alias (optional)", "cityAlias")}
    <fieldset style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}><legend>Distances</legend>{[1, 2, 3, 4].map((index) => { const distance = event?.distances?.[index - 1]; const km = distance?.distanceKm == null ? "" : typeof distance.distanceKm === "number" ? distance.distanceKm : distance.distanceKm.toNumber(); return <div key={index} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 8 }}><input name={`distance${index}Name`} placeholder="Distance name" defaultValue={distance?.name ?? ""} style={fieldStyle} /><input name={`distance${index}Km`} type="number" min="0" step="0.001" placeholder="KM" defaultValue={km} style={fieldStyle} /><select name={`distance${index}Discipline`} defaultValue={distance?.discipline ?? "OTHER"} style={fieldStyle}>{["RUN", "BIKE", "SWIM", "WALK", "ROW", "OTHER"].map((item) => <option key={item}>{item}</option>)}</select></div>; })}</fieldset>
    {sources.length > 0 && <label style={{ display: "grid", gap: 5 }}>Source record<select name="sourceId" defaultValue={initialSourceId ?? ""} style={fieldStyle}><option value="">Manual</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>}
    <label style={{ display: "grid", gap: 5 }}>Status<select name="status" defaultValue={event?.status && !["PENDING_REVIEW", "DRAFT", "REJECTED"].includes(event.status) ? "PUBLISHED" : "PENDING_REVIEW"} style={fieldStyle}><option value="PENDING_REVIEW">Pending review</option><option value="PUBLISHED">Published</option></select></label>
    <button className="button" type="submit">Save event</button>
  </form>;
}

const fieldStyle = { width: "100%", padding: 10, border: "1px solid var(--line)", borderRadius: 7, font: "inherit" };
