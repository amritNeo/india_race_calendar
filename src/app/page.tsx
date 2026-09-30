import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { EventFiltersForm } from "@/components/event-filters";
import { listEvents } from "@/lib/events";

export default async function HomePage() {
  const events = (await listEvents()).slice(0, 6);
  return (
    <main>
      <section className="home-hero">
        <div className="container home-hero-inner">
          <div className="eyebrow">India&apos;s endurance event calendar</div>
          <h1>Find your next race in India.</h1>
          <p className="home-hero-copy">
            Discover marathons, ultras, triathlons, cycling events, HYROX,
            duathlons, hybrid races and more.
          </p>
          <EventFiltersForm />
        </div>
      </section>
      <section className="container home-events">
        <div className="home-events-header">
          <div>
            <div className="eyebrow">Make a date with the start line</div>
            <h2>Upcoming events</h2>
          </div>
          <Link href="/events" className="button">All events <span aria-hidden="true">→</span></Link>
        </div>
        <div className="event-grid">
          {events.map((event) => <EventCard key={event.id} event={event} />)}
        </div>
      </section>
      <section className="container" style={{ paddingTop: 56 }}>
        <div className="home-cta">
          <div>
            <div style={{ opacity: .76, fontSize: 13 }}>Built for every distance and every pace</div>
            <h2>Your next finish line is out there.</h2>
          </div>
          <Link className="button button-light" href="/cities">Explore by city</Link>
        </div>
      </section>
    </main>
  );
}
