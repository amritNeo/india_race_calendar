import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const siteUrl = process.env.PUB_SI_URL ?? "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "India Race Calendar | Find your next race",
    template: "%s | India Race Calendar",
  },
  description:
    "Discover upcoming marathons, ultras, triathlons, cycling events and more across India.",
  openGraph: {
    type: "website",
    siteName: "India Race Calendar",
    title: "India Race Calendar",
    description: "Find your next race in India.",
  },
  twitter: {
    card: "summary_large_image",
    title: "India Race Calendar",
    description: "Find your next race in India.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header
          style={{ background: "white", borderBottom: "1px solid var(--line)" }}
        >
          <div className="container site-header">
            <Link
              className="site-brand"
              href="/"
              style={{ fontWeight: 800, letterSpacing: "-.04em", fontSize: 19 }}
            >
              India Race Calendar
              <span style={{ color: "var(--green)" }}>.</span>
            </Link>
            <nav className="site-nav" aria-label="Main navigation">
              <Link href="/">Home</Link>
              <Link href="/events">Events</Link>
              <Link href="/cities">Cities</Link>
              <Link href="/about">About</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer
          style={{
            marginTop: 80,
            borderTop: "1px solid var(--line)",
            background: "white",
          }}
        >
          <div
            className="container"
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingBlock: 26,
              color: "var(--muted)",
              fontSize: 13,
            }}
          >
            <span>India Race Calendar · Find your next start line.</span>
            <Link href="/about">About this project</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
