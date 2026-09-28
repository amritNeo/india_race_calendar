import { describe, expect, it } from "vitest";
import { extractEventsFromHtml, extractInternalLinks, extractSitemapLocations } from "./adapters/web-extraction";
import { parseRobotsTxt, robotsDecision } from "./adapters/website";
import { canonicalizeUrl, fetchPublicText, isPublicIpAddress } from "./adapters/web-fetch";

describe("website crawler safety and extraction", () => {
  it("canonicalizes fragments, tracking parameters, duplicate query values, and trailing slashes", () => {
    expect(canonicalizeUrl("/events/race/?utm_source=mail&b=2&a=1&b=1#details", "https://example.org"))
      .toBe("https://example.org/events/race?a=1&b=1&b=2");
  });

  it.each([
    ["127.0.0.1", false], ["10.2.3.4", false], ["172.16.0.1", false], ["192.168.1.1", false],
    ["169.254.169.254", false], ["100.64.0.1", false], ["::1", false], ["fe80::1", false],
    ["fc00::1", false], ["2001:db8::1", false], ["8.8.8.8", true], ["2606:4700:4700::1111", true],
  ])("classifies %s as public=%s", (address, expected) => {
    expect(isPublicIpAddress(address)).toBe(expected);
  });

  it("rejects private IP destinations before making a request", async () => {
    await expect(fetchPublicText({
      url: "http://127.0.0.1/robots.txt",
      allowedHostname: "127.0.0.1",
      accept: "text/plain",
      allowedContentTypes: ["text/plain"],
      maxBytes: 1000,
    })).rejects.toThrow(/non-routable|private/i);
  });

  it("applies the most specific robots rule and parses crawl delay and sitemap references", () => {
    const robots = parseRobotsTxt(`User-agent: *\nDisallow: /private\nSitemap: https://races.example/sitemap.xml\n\nUser-agent: IndiaRaceCalendarBot\nCrawl-delay: 2\nDisallow: /events\nAllow: /events/open`);
    expect(robotsDecision(robots, "https://races.example/events/secret").status).toBe("DISALLOWED");
    expect(robotsDecision(robots, "https://races.example/events/open")).toMatchObject({ status: "ALLOWED", crawlDelayMs: 2000 });
    expect(robots.sitemaps).toEqual(["https://races.example/sitemap.xml"]);
  });

  it("extracts nested Schema.org events while ignoring malformed JSON-LD blocks", () => {
    const html = `<script type="application/ld+json">{bad json}</script>
      <script type="application/ld+json">{"@graph":[{"@type":"SportsEvent","name":"Pune 10K Run","startDate":"2027-01-10T06:00:00+05:30","endDate":"2027-01-10","description":"A city race","location":{"@type":"Place","name":"Racecourse","address":{"@type":"PostalAddress","addressLocality":"Pune","addressRegion":"Maharashtra"}},"organizer":{"@type":"Organization","name":"Race Club"},"offers":{"@type":"Offer","url":"https://races.example/register"}}]}</script>`;
    expect(extractEventsFromHtml(html, "https://races.example/events/pune-10k")).toMatchObject([{
      name: "Pune 10K Run", startDate: "2027-01-10T06:00:00+05:30", city: "Pune", venue: "Racecourse",
      organizer: "Race Club", registrationUrl: "https://races.example/register", category: "10k",
    }]);
  });

  it("limits extracted links to the configured host and skips binary documents", () => {
    const html = `<a href="/events?utm_source=x#r">Marathon</a><a href="https://elsewhere.example/race">Race</a><a href="/rules.pdf">Rules</a>`;
    expect(extractInternalLinks(html, "https://races.example/", "races.example")).toEqual([
      { url: "https://races.example/events", anchor: "Marathon" },
    ]);
  });

  it("extracts sitemap locations", () => {
    expect(extractSitemapLocations("<urlset><url><loc>https://races.example/events/1</loc></url></urlset>")).toEqual(["https://races.example/events/1"]);
  });
});
