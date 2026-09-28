import { getPrisma } from "@/lib/db";
import { nameSimilarity } from "@/lib/ingestion/deduplication";
import { resolveDuplicateAction } from "@/app/admin/actions";

export default async function DuplicateReviewPage() {
  const prisma = getPrisma();
  if (!prisma) return <p>Connect a database to review possible duplicates.</p>;
  const pending = await prisma.event.findMany({
    where: { status: { in: ["PENDING_REVIEW", "PUBLISHED"] } },
    take: 150,
    orderBy: { startDate: "asc" },
    include: {
      city: true,
      category: true,
      sourceRecords: { include: { source: true } },
    },
  });
  const cityIds = [...new Set(pending.map((event) => event.cityId))];
  const dates = [...new Set(pending.map((event) => event.startDate))];
  const decisions = await prisma.duplicatePairDecision.findMany({
    select: { pairKey: true },
  });
  const excluded = new Set(decisions.map((decision) => decision.pairKey));
  const all = await prisma.event.findMany({
    where: {
      cityId: { in: cityIds },
      startDate: { in: dates },
      status: { in: ["PENDING_REVIEW", "PUBLISHED"] },
    },
    take: 500,
    orderBy: { startDate: "asc" },
    include: { city: true, sourceRecords: { include: { source: true } } },
  });
  const pairs: {
    a: (typeof all)[number];
    b: (typeof all)[number];
    score: number;
  }[] = [];
  const seen = new Set<string>();
  for (const a of all)
    for (const b of all) {
      if (
        a.id === b.id ||
        a.cityId !== b.cityId ||
        a.startDate.toISOString().slice(0, 10) !==
          b.startDate.toISOString().slice(0, 10)
      )
        continue;
      const pairKey = [a.id, b.id].sort().join(":");
      if (seen.has(pairKey) || excluded.has(pairKey)) continue;
      seen.add(pairKey);
      const score = nameSimilarity(a.name, b.name);
      if (score >= 0.72) pairs.push({ a, b, score });
    }
  pairs.sort((left, right) => right.score - left.score);
  return (
    <>
      <h1>Possible duplicates</h1>
      <p>
        Pairs require a matching city and event date, plus normalized name
        similarity of at least 72%. No automatic merges are made.
      </p>
      {pairs.length ? (
        pairs.map(({ a, b, score }) => (
          <article key={`${a.id}-${b.id}`} style={card}>
            <strong>
              {score >= 0.88 ? "High similarity" : "Possible match"} ·{" "}
              {Math.round(score * 100)}%
            </strong>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                gap: 14,
                margin: "12px 0",
              }}
            >
              {[a, b].map((event) => (
                <div
                  key={event.id}
                  style={{
                    padding: 12,
                    background: "#f5f7f5",
                    borderRadius: 8,
                  }}
                >
                  <b>{event.name}</b>
                  <div>
                    {event.startDate.toLocaleDateString("en-IN")} ·{" "}
                    {event.city.name}
                  </div>
                  <div>
                    {event.sourceRecords
                      .map((record) => record.source.name)
                      .join(", ") ||
                      event.sourceName ||
                      "Manual"}
                  </div>
                  <small>Status: {event.status}</small>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <form action={resolveDuplicateAction}>
                <input type="hidden" name="canonicalId" value={a.id} />
                <input type="hidden" name="otherId" value={b.id} />
                <input type="hidden" name="decision" value="MERGE" />
                <button className="button">
                  Merge into {a.name.slice(0, 28)}
                </button>
              </form>
              <form action={resolveDuplicateAction}>
                <input type="hidden" name="canonicalId" value={a.id} />
                <input type="hidden" name="otherId" value={b.id} />
                <input type="hidden" name="decision" value="SEPARATE" />
                <button>Keep separate</button>
              </form>
              <form action={resolveDuplicateAction}>
                <input type="hidden" name="canonicalId" value={a.id} />
                <input type="hidden" name="otherId" value={b.id} />
                <input type="hidden" name="decision" value="IGNORE" />
                <button>Ignore pair</button>
              </form>
            </div>
          </article>
        ))
      ) : (
        <p>No possible duplicates found.</p>
      )}
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
