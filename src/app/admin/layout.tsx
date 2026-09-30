import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    return (
      <main className="container" style={{ paddingTop: 60, maxWidth: 700 }}>
        <h1>Admin unavailable</h1>
        <p>The admin area is not authenticated and is disabled in production. Configure authentication before enabling production administration.</p>
      </main>
    );
  }

  return (
    <main className="container admin-shell" style={{ paddingTop: 36, maxWidth: 1000 }}>
      <div className="admin-notice" role="note" style={{ padding: 14, background: "#fff2dc", border: "1px solid #f0d9ae", color: "#674818", fontSize: 13 }}>
        <strong>Development admin area — not production-secure.</strong> Authentication is not configured. Admin changes are disabled in production.
      </div>
      <nav aria-label="Admin navigation" className="admin-nav">
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/events">Events</Link>
        <Link href="/admin/events/pending">Pending review</Link>
        <Link href="/admin/events/new">New event</Link>
        <Link href="/admin/duplicates">Duplicates</Link>
        <Link href="/admin/sources">Sources</Link>
      </nav>
      {children}
    </main>
  );
}
