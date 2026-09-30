import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/auth-actions";
import { EventCard } from "@/components/event-card";
import { getAuthenticatedUser } from "@/lib/auth";
import { listEvents } from "@/lib/events";

export const metadata: Metadata = { title: "Your dashboard", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const events = (await listEvents()).slice(0, 3);
  const metadata = user.user_metadata as Record<string, unknown>;
  const name = [metadata.full_name, metadata.name, metadata.username, user.email?.split("@")[0]]
    .find((value): value is string => typeof value === "string" && value.length > 0) ?? "athlete";
  const providers = Array.isArray(user.app_metadata.providers) ? user.app_metadata.providers : [];
  const connectedWithStrava = providers.includes("custom:strava") || providers.includes("strava");

  return (
    <main className="container dashboard-page">
      <section className="dashboard-welcome">
        <div>
          <div className="eyebrow">Your race season starts here</div>
          <h1>Welcome, {name}.</h1>
          <p>Find an event that gives your next training block a finish line.</p>
        </div>
        <div className="dashboard-account">
          <span className="account-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
          <div><strong>{user.email ?? name}</strong><span>{connectedWithStrava ? "Strava connected" : "Your athlete dashboard"}</span></div>
          <form action={signOutAction}><button type="submit">Sign out</button></form>
        </div>
      </section>

      <section className="dashboard-shortcuts" aria-label="Quick links">
        <Link href="/events"><span className="shortcut-icon" aria-hidden="true">↗</span><span><strong>Explore events</strong><small>Search the race calendar</small></span><span className="shortcut-arrow" aria-hidden="true">→</span></Link>
        <Link href="/cities"><span className="shortcut-icon" aria-hidden="true">⌖</span><span><strong>Browse by city</strong><small>See events near you</small></span><span className="shortcut-arrow" aria-hidden="true">→</span></Link>
      </section>

      <section className="dashboard-events">
        <div className="home-events-header"><div><div className="eyebrow">Find your next challenge</div><h2>Upcoming events</h2></div><Link href="/events" className="text-link">View all events <span aria-hidden="true">→</span></Link></div>
        {events.length ? <div className="event-grid">{events.map((event) => <EventCard key={event.id} event={event} />)}</div> : <p className="empty-state">No events are listed yet. Check back soon.</p>}
      </section>
    </main>
  );
}
