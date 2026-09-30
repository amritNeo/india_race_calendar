import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getAuthenticatedUser();
  if (user) redirect("/dashboard");

  return (
    <main>
      <section className="home-hero landing-hero">
        <div className="container home-hero-inner">
          <div className="eyebrow">India&apos;s endurance event calendar</div>
          <h1>Your next start line is closer than you think.</h1>
          <p className="home-hero-copy">
            Browse races across India and find a challenge that fits your
            training season.
          </p>
          <div className="landing-actions">
            <Link className="button" href="/signup">Create your free account <span aria-hidden="true">→</span></Link>
            <Link className="landing-secondary" href="/events">Explore the race calendar</Link>
          </div>
          <div className="landing-trust">Sign in with Strava, Google, or your email and password.</div>
        </div>
      </section>

      <section className="container landing-highlights" aria-label="What you can do">
        <article><span className="highlight-number">01</span><h2>Find your next event</h2><p>Browse races by city, date, distance, and discipline.</p></article>
        <article><span className="highlight-number">02</span><h2>Browse by city</h2><p>Explore races and fitness events around India.</p></article>
        <article><span className="highlight-number">03</span><h2>Sign in your way</h2><p>Use email and password, Google, or Strava.</p></article>
      </section>
      <section className="container landing-bottom"><p>Ready to find your next challenge?</p><Link href="/login">Sign in to your account <span aria-hidden="true">→</span></Link></section>
    </main>
  );
}
