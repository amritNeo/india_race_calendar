import type { Metadata } from "next";
import Link from "next/link";
import { getCities } from "@/lib/events";
export const metadata: Metadata = {
  title: "Cities",
  description: "Explore endurance and fitness events by city across India.",
  alternates: { canonical: "/cities" },
};
export default async function CitiesPage() {
  const cities = await getCities();
  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <div className="eyebrow">Explore locally</div>
      <h1
        style={{ fontSize: 42, letterSpacing: "-.05em", margin: "8px 0 10px" }}
      >
        Events by city
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: 26 }}>
        Pick a city and find your next start line.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
          gap: 14,
        }}
      >
        {cities.map((city) => (
          <Link
            key={city.slug}
            href={`/cities/${city.slug}`}
            style={{
              background: "white",
              border: "1px solid var(--line)",
              padding: 20,
              borderRadius: 12,
            }}
          >
            <strong>{city.name}</strong>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
              {city.state.name} →
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
