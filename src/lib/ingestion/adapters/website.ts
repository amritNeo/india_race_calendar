import type { EventSourceAdapter, NormalizedEvent, RawEvent } from "../types";
import { normalizeFeedEvent } from "../normalization";
import { extractEventsFromHtml, extractInternalLinks, extractSitemapLocations, scoreEventUrl } from "./web-extraction";
import { fetchPublicText, RobotsDisallowedError, WebsiteAccessBlockedError, canonicalizeUrl } from "./web-fetch";

type RobotsRule = { allow: boolean; path: string };
type RobotsGroup = { agents: string[]; rules: RobotsRule[]; crawlDelayMs?: number };
type RobotsConfig = { groups: RobotsGroup[]; sitemaps: string[] };
export type RobotsDecision = { status: "ALLOWED" | "DISALLOWED" | "UNKNOWN"; reason: string; crawlDelayMs: number; sitemaps: string[] };

export class WebsiteCrawlBlockedError extends Error {
  constructor(message: string) { super(message); this.name = "WebsiteCrawlBlockedError"; }
}

export function parseRobotsTxt(text: string): RobotsConfig {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let sawRule = false;
  for (const sourceLine of text.split(/\r?\n/)) {
    const line = sourceLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "sitemap") { if (value) sitemaps.push(value); continue; }
    if (key === "user-agent") {
      if (!current || sawRule) { current = { agents: [], rules: [] }; groups.push(current); sawRule = false; }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (value) current.rules.push({ allow: key === "allow", path: value });
      sawRule = true;
    } else if (key === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelayMs = Math.min(86_400_000, seconds * 1000);
      sawRule = true;
    }
  }
  return { groups, sitemaps };
}

function robotsRuleMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const source = pattern.replace(/\$$/, "").split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`).test(path);
}

export function robotsDecision(config: RobotsConfig, url: string, userAgent = "IndiaRaceCalendarBot"): RobotsDecision {
  const applicable = config.groups.map((group) => ({ group, specificity: Math.max(0, ...group.agents.filter((agent) => agent === "*" || userAgent.toLowerCase().includes(agent)).map((agent) => agent === "*" ? 0 : agent.length)) }));
  const explicitMatches = applicable.filter(({ specificity }) => specificity > 0);
  const selected = explicitMatches.length ? explicitMatches : applicable.filter(({ group }) => group.agents.includes("*"));
  const rules = selected.flatMap(({ group }) => group.rules);
  const parsed = new URL(url);
  const path = `${parsed.pathname}${parsed.search}`;
  const matching = rules.filter((rule) => robotsRuleMatches(rule.path, path)).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  const winner = matching[0];
  const crawlDelayMs = Math.max(0, ...selected.map(({ group }) => group.crawlDelayMs ?? 0));
  if (winner && !winner.allow) return { status: "DISALLOWED", reason: `robots.txt disallows ${path}.`, crawlDelayMs, sitemaps: config.sitemaps };
  if (config.groups.length === 0) return { status: "UNKNOWN", reason: "robots.txt contained no applicable rules.", crawlDelayMs, sitemaps: config.sitemaps };
  return { status: "ALLOWED", reason: winner?.allow ? `robots.txt allows ${path}.` : `No robots.txt rule disallows ${path}.`, crawlDelayMs, sitemaps: config.sitemaps };
}

function urlHasAllowedHost(input: string, hostname: string, base?: string): string | null {
  try {
    const value = new URL(canonicalizeUrl(input, base));
    return ["http:", "https:"].includes(value.protocol) && value.hostname.toLowerCase() === hostname.toLowerCase() && !value.username && !value.password ? value.toString() : null;
  } catch { return null; }
}

function eventScore(url: string, anchor: string, sitemap = false): number {
  return scoreEventUrl(url, anchor) + (sitemap ? 1 : 0);
}

export class WebsiteAdapter implements EventSourceAdapter {
  private robotsStatus: "ALLOWED" | "DISALLOWED" | "UNKNOWN" = "UNKNOWN";
  private robotsReason = "robots.txt has not been checked.";

  constructor(
    public sourceName: string,
    private readonly baseUrl: string,
    private readonly crawlDepth = 2,
    private readonly maxPagesPerRun = 50,
  ) {}

  getRunMetadata() { return { robotsStatus: this.robotsStatus, robotsReason: this.robotsReason }; }

  async normalize(rawEvent: RawEvent): Promise<NormalizedEvent> { return normalizeFeedEvent(rawEvent); }

  async discover(): Promise<RawEvent[]> {
    const base = new URL(this.baseUrl);
    const allowedHostname = base.hostname.toLowerCase();
    const origin = base.origin;
    const robotsUrl = `${origin}/robots.txt`;
    let robots: RobotsConfig = { groups: [], sitemaps: [] };
    let robotsUnknownReason = "";
    try {
      const response = await fetchPublicText({ url: robotsUrl, allowedHostname, accept: "text/plain", allowedContentTypes: ["text/plain"], maxBytes: 512 * 1024, allowNotFound: true });
      if (response.status === 404) {
        this.robotsStatus = "UNKNOWN";
        robotsUnknownReason = "robots.txt was not found; crawling proceeded with conservative rate limits.";
      } else {
        robots = parseRobotsTxt(response.body);
      }
    } catch (error) {
      this.robotsStatus = "UNKNOWN";
      this.robotsReason = error instanceof Error ? `Could not read robots.txt: ${error.message}` : "Could not read robots.txt.";
      if (error instanceof WebsiteAccessBlockedError) throw new WebsiteCrawlBlockedError(this.robotsReason);
      throw error;
    }

    const rootDecision = robotsDecision(robots, this.baseUrl);
    if (rootDecision.status === "DISALLOWED") {
      this.robotsStatus = "DISALLOWED";
      this.robotsReason = rootDecision.reason;
      throw new WebsiteCrawlBlockedError(rootDecision.reason);
    }
    if (rootDecision.crawlDelayMs > 300_000) {
      this.robotsStatus = rootDecision.status;
      this.robotsReason = `robots.txt requires a ${Math.ceil(rootDecision.crawlDelayMs / 1000)} second crawl delay, which exceeds the per-run execution limit; no pages were crawled.`;
      throw new WebsiteCrawlBlockedError(this.robotsReason);
    }
    if (!robotsUnknownReason) this.robotsStatus = rootDecision.status;
    this.robotsReason = robotsUnknownReason || rootDecision.reason;
    const crawlDelayMs = Math.max(400, rootDecision.crawlDelayMs);

    const home = urlHasAllowedHost(this.baseUrl, allowedHostname);
    if (!home) throw new Error("Website URL must use HTTP or HTTPS and have a valid hostname.");
    const homeDecision = robotsDecision(robots, home);
    if (homeDecision.status === "DISALLOWED") {
      this.robotsStatus = "DISALLOWED";
      this.robotsReason = homeDecision.reason;
      throw new WebsiteCrawlBlockedError(homeDecision.reason);
    }
    let homeResponse;
    try {
      homeResponse = await fetchPublicText({
        url: home,
        allowedHostname,
        accept: "text/html,application/xhtml+xml,application/json",
        allowedContentTypes: ["text/html", "application/xhtml+xml", "application/json"],
        maxBytes: 2 * 1024 * 1024,
        timeoutMs: 8_000,
        crawlDelayMs,
        isRobotsAllowed: (url) => robotsDecision(robots, url).status !== "DISALLOWED",
      });
    } catch (error) {
      if (error instanceof RobotsDisallowedError) {
        this.robotsStatus = "DISALLOWED";
        this.robotsReason = error.message;
        throw new WebsiteCrawlBlockedError(error.message);
      }
      if (error instanceof WebsiteAccessBlockedError) throw new WebsiteCrawlBlockedError(error.message);
      throw error;
    }
    if (homeResponse.contentType === "application/json") {
      try {
        const body = JSON.parse(homeResponse.body) as unknown;
        const items = Array.isArray(body) ? body : body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events) ? (body as { events: unknown[] }).events : null;
        if (!items) throw new Error("JSON feed must be an array or an object with an events array.");
        return items.filter((item): item is RawEvent => Boolean(item) && typeof item === "object" && !Array.isArray(item)).slice(0, 25).map((item, index) => ({
          ...item,
          externalId: typeof item.externalId === "string" && item.externalId ? item.externalId : `${homeResponse.url}#feed-${index + 1}`,
          sourceUrl: typeof item.sourceUrl === "string" && item.sourceUrl ? item.sourceUrl : homeResponse.url,
        }));
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : "JSON feed could not be parsed.");
      }
    }

    const sitemapUrls = new Set<string>([`${origin}/sitemap.xml`, ...robots.sitemaps]);
    const sitemapPages = new Map<string, number>();
    const sitemapVisited = new Set<string>();
    const maxSitemapCandidates = this.maxPagesPerRun * 10;
    while (sitemapUrls.size && sitemapVisited.size < 20) {
      const sitemap = sitemapUrls.values().next().value as string;
      sitemapUrls.delete(sitemap);
      const safeSitemap = urlHasAllowedHost(sitemap, allowedHostname);
      if (!safeSitemap || sitemapVisited.has(safeSitemap)) continue;
      sitemapVisited.add(safeSitemap);
      const decision = robotsDecision(robots, safeSitemap);
      if (decision.status === "DISALLOWED") continue;
      try {
        const response = await fetchPublicText({ url: safeSitemap, allowedHostname, accept: "application/xml,text/xml", allowedContentTypes: ["application/xml", "text/xml"], maxBytes: 2 * 1024 * 1024, crawlDelayMs, allowNotFound: true, isRobotsAllowed: (url) => robotsDecision(robots, url).status !== "DISALLOWED" });
        if (response.status === 404) continue;
        const locations = extractSitemapLocations(response.body);
        const isIndex = /<sitemapindex\b/i.test(response.body);
        for (const location of locations.slice(0, 1000)) {
          const safe = urlHasAllowedHost(location, allowedHostname, response.url);
          if (!safe) continue;
          if (isIndex && !sitemapVisited.has(safe) && sitemapUrls.size < 20) sitemapUrls.add(safe);
          else if (!isIndex && sitemapPages.size < maxSitemapCandidates) sitemapPages.set(safe, eventScore(safe, "", true));
        }
      } catch (error) {
        if (error instanceof WebsiteCrawlBlockedError) throw error;
        if (error instanceof WebsiteAccessBlockedError) throw new WebsiteCrawlBlockedError(error.message);
        if (error instanceof RobotsDisallowedError) continue;
        // A missing or malformed sitemap does not prevent homepage discovery.
      }
    }

    const queue: { url: string; depth: number; score: number }[] = [{ url: home, depth: 0, score: Number.MAX_SAFE_INTEGER }];
    const scheduled = new Set([home]);
    for (const [url, score] of sitemapPages) {
      if (!scheduled.has(url)) { scheduled.add(url); queue.push({ url, depth: 1, score }); }
    }
    const visited = new Set<string>();
    const events: RawEvent[] = [];
    const prefetched = new Map([[home, homeResponse]]);
    let skippedRobotsUrls = 0;
    const skippedRobotsSamples: string[] = [];

    while (queue.length && visited.size < this.maxPagesPerRun) {
      queue.sort((a, b) => b.score - a.score || a.depth - b.depth || a.url.localeCompare(b.url));
      const candidate = queue.shift()!;
      if (visited.has(candidate.url)) continue;
      visited.add(candidate.url);
      const decision = robotsDecision(robots, candidate.url);
      if (decision.status === "DISALLOWED") {
        skippedRobotsUrls++;
        if (skippedRobotsSamples.length < 3) skippedRobotsSamples.push(new URL(candidate.url).pathname);
        continue;
      }
      let response;
      try {
        response = prefetched.get(candidate.url) ?? await fetchPublicText({ url: candidate.url, allowedHostname, accept: "text/html,application/xhtml+xml", allowedContentTypes: ["text/html", "application/xhtml+xml"], maxBytes: 2 * 1024 * 1024, timeoutMs: 8_000, crawlDelayMs, isRobotsAllowed: (url) => robotsDecision(robots, url).status !== "DISALLOWED" });
      } catch (error) {
        if (error instanceof WebsiteAccessBlockedError) throw new WebsiteCrawlBlockedError(error.message);
        if (error instanceof RobotsDisallowedError) {
          skippedRobotsUrls++;
          if (skippedRobotsSamples.length < 3) skippedRobotsSamples.push(new URL(candidate.url).pathname);
          continue;
        }
        // Individual unavailable candidate pages should not stop the source run.
        continue;
      }
      visited.add(canonicalizeUrl(response.url));
      if (candidate.depth < this.crawlDepth) {
        for (const link of extractInternalLinks(response.body, response.url, allowedHostname)) {
          if (visited.has(link.url) || scheduled.has(link.url)) continue;
          if (scheduled.size >= this.maxPagesPerRun * 20) break;
          scheduled.add(link.url);
          queue.push({ url: link.url, depth: candidate.depth + 1, score: eventScore(link.url, link.anchor) });
        }
      }
      for (const raw of extractEventsFromHtml(response.body, response.url)) {
        raw.externalId = `${response.url}#${String(raw.externalId ?? events.length)}`;
        raw.sourceUrl = response.url;
        events.push(raw);
      }
    }
    if (skippedRobotsUrls) {
      this.robotsReason = `${this.robotsReason} Skipped ${skippedRobotsUrls} disallowed page(s)${skippedRobotsSamples.length ? `, including ${skippedRobotsSamples.join(", ")}` : ""}.`;
    }
    return events;
  }
}
