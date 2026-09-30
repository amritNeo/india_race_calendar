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
        <header className="site-header-wrap">
          <div className="container site-header">
            <Link className="site-brand" href="/">
              <span className="brand-mark" aria-hidden="true">IRC</span>
              India Race Calendar<span style={{ color: "var(--green)" }}>.</span>
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
        <footer className="site-footer">
          <div className="container site-footer-inner">
            <span>India Race Calendar · Find your next start line.</span>
            <Link href="/about">About this project</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
