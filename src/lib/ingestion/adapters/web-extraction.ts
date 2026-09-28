import { normalizeCategory, normalizeText } from "../normalization";
import type { RawEvent } from "../types";
import { canonicalizeUrl } from "./web-fetch";

const EVENT_TYPE = /(?:^|\/)(?:Event|SportsEvent|BusinessEvent|Festival|RaceEvent)$/i;

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => { const point = Number(code); return point <= 0x10ffff ? String.fromCodePoint(point) : ""; })
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => { const point = parseInt(code, 16); return point <= 0x10ffff ? String.fromCodePoint(point) : ""; });
}

function textContent(value: string): string {
  return decodeHtml(value.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(regex)) result[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  return result;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value.trim()].filter(Boolean);
  if (typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return strings(object.name ?? object.value ?? object.url ?? object["@id"]);
  }
  return [];
}

function first(value: unknown): string | undefined { return strings(value)[0]; }

function objects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(objects);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  const nested = [object["@graph"], object.itemListElement].flatMap(objects);
  return [object, ...nested];
}

function locationFields(value: unknown): { city?: string; venue?: string } {
  const location = Array.isArray(value) ? value[0] : value;
  if (typeof location === "string") {
    const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
    return { ...(parts.length ? { city: parts.length > 1 ? parts[parts.length - 2] : parts[0] } : {}), venue: parts.length > 2 ? parts.slice(0, -2).join(", ") : undefined };
  }
  if (!location || typeof location !== "object") return {};
  const place = location as Record<string, unknown>;
  const address = place.address && typeof place.address === "object" ? place.address as Record<string, unknown> : {};
  const city = first(address.addressLocality) ?? first(place.addressLocality);
  const venue = first(place.name);
  return { ...(city ? { city } : {}), ...(venue ? { venue } : {}) };
}

function makeRawEvent(fields: Record<string, unknown>, pageUrl: string, index: number): RawEvent | null {
  const name = first(fields.name) ?? first(fields.headline);
  const startDate = first(fields.startDate) ?? first(fields.startTime);
  if (!name || !startDate) return null;
  const location = locationFields(fields.location);
  const address = fields.location && typeof fields.location === "object" && !Array.isArray(fields.location)
    ? (fields.location as Record<string, unknown>).address : undefined;
  const addressObject = address && typeof address === "object" ? address as Record<string, unknown> : {};
  const city = location.city ?? first(addressObject.addressLocality) ?? first(fields.city);
  const categoryEvidence = [first(fields.category), ...strings(fields.keywords), name, first(fields.description), pageUrl].filter(Boolean).join(" ");
  const organizer = first(fields.organizer);
  const offer = Array.isArray(fields.offers) ? fields.offers[0] : fields.offers;
  const asAbsoluteWebUrl = (value: string | undefined): string | undefined => {
    if (!value) return undefined;
    try {
      const url = new URL(value, pageUrl);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : undefined;
    } catch { return undefined; }
  };
  const registrationUrl = asAbsoluteWebUrl(offer && typeof offer === "object" ? first((offer as Record<string, unknown>).url) : undefined);
  const officialWebsiteUrl = asAbsoluteWebUrl(first(fields.url)) ?? pageUrl;
  const raw: RawEvent = {
    externalId: first(fields.identifier) ?? first(fields.url) ?? `${pageUrl}#event-${index + 1}`,
    sourceUrl: pageUrl,
    title: name.slice(0, 300),
    name: name.slice(0, 300),
    description: (first(fields.description) ?? "").slice(0, 4000),
    startDate,
    endDate: first(fields.endDate) ?? "",
    city: city?.slice(0, 200) ?? "",
    category: normalizeCategory(categoryEvidence),
    venue: (location.venue ?? first(addressObject.streetAddress) ?? "").slice(0, 300),
    organizer: (organizer ?? "").slice(0, 300),
    registrationUrl: registrationUrl ?? "",
    officialWebsiteUrl,
  };
  const evidence = [first(fields.category), ...strings(fields.name), ...strings(fields.description)].join(" ");
  const distance = evidence.match(/\b(\d+(?:\.\d+)?)\s*(km|k)\b/i);
  if (distance) {
    const normalizedEvidence = normalizeText(evidence);
    const discipline = /cycl|bike|mtb|gravel/.test(normalizedEvidence) ? "BIKE" : /swim|aquathlon/.test(normalizedEvidence) ? "SWIM" : /walk/.test(normalizedEvidence) ? "WALK" : "RUN";
    raw.distances = [{ name: distance[0], distanceKm: Number(distance[1]), discipline }];
  }
  return raw;
}

function isEventObject(object: Record<string, unknown>): boolean {
  return strings(object["@type"]).some((type) => EVENT_TYPE.test(type) || /schema\.org\/(?:Event|SportsEvent)/i.test(type));
}

function jsonLdEvents(html: string, pageUrl: string): RawEvent[] {
  const events: RawEvent[] = [];
  const scriptPattern = /<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const script of html.matchAll(scriptPattern)) {
    try {
      const value = JSON.parse(script[1].replace(/<!--[\s\S]*?-->/g, "").trim()) as unknown;
      for (const object of objects(value)) if (isEventObject(object)) {
        const raw = makeRawEvent(object, pageUrl, events.length);
        if (raw) events.push(raw);
      }
    } catch {
      // A malformed JSON-LD block must not prevent other blocks or HTML fallback.
    }
  }
  return events;
}

function microdataFields(html: string): Record<string, unknown> | null {
  const hasEventScope = /\bitemtype\s*=\s*["'][^"']*schema\.org\/(?:Event|SportsEvent)["']/i.test(html);
  if (!hasEventScope) return null;
  const result: Record<string, unknown> = {};
  const tags = /<([a-z][\w:-]*)\b([^>]*\bitemprop\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*)>([\s\S]*?)(?:<\/\1\s*>|(?=<))/gi;
  for (const match of html.matchAll(tags)) {
    const props = (match[3] ?? match[4] ?? match[5] ?? "").split(/\s+/);
    const attrs = attributes(`<${match[1]} ${match[2]}>`);
    const content = attrs.content ?? attrs.datetime ?? attrs.value ?? attrs.href ?? attrs.src ?? textContent(match[6] ?? "");
    for (const prop of props) if (content && result[prop] === undefined) result[prop] = content;
  }
  const raw = {
    name: result.name,
    description: result.description,
    startDate: result.startDate,
    endDate: result.endDate,
    location: result.location ? { name: result.location, address: { addressLocality: result.addressLocality } } : undefined,
    organizer: result.organizer,
    category: result.category,
    url: result.url,
    offers: result.offers,
  };
  return raw.name && raw.startDate ? raw : null;
}

function metadata(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (key && attrs.content && result[key] === undefined) result[key] = attrs.content;
  }
  return result;
}

function firstTagText(html: string, tagName: string): string | undefined {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}\\s*>`, "i"));
  return match ? textContent(match[1]) : undefined;
}

function semanticDate(html: string): string | undefined {
  const timeMatch = html.match(/<time\b[^>]*datetime\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/i);
  const direct = timeMatch?.[1] ?? timeMatch?.[2] ?? timeMatch?.[3];
  if (direct) return direct;
  const visible = textContent(html).match(/\b(?:\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+20\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2})\b/i);
  return visible?.[0] ? new Date(visible[0]).toISOString().slice(0, 10) : undefined;
}

function candidateFromHtml(html: string, pageUrl: string): RawEvent[] {
  const meta = metadata(html);
  const title = firstTagText(html, "h1") ?? meta["og:title"] ?? firstTagText(html, "title");
  const startDate = semanticDate(html);
  const plainText = textContent(html).slice(0, 20_000);
  if (!title || !startDate || !/(event|race|marathon|triathlon|duathlon|ultra|trail|cycling|cycle|bike|hyrox|hybrid|adventure|walkathon|crossfit|ocr)/i.test(`${title} ${pageUrl} ${plainText.slice(0, 1500)}`)) return [];
  const cityMatch = html.match(/<[^>]*\bitemprop\s*=\s*["']addressLocality["'][^>]*>([\s\S]*?)<\//i);
  const addressMatch = html.match(/<address\b[^>]*>([\s\S]*?)<\/address>/i);
  const addressParts = addressMatch ? textContent(addressMatch[1]).split(",").map((part) => part.trim()).filter(Boolean) : [];
  const city = cityMatch ? textContent(cityMatch[1]) : addressParts.length > 1 ? addressParts[addressParts.length - 2] : addressParts[0] ?? "";
  const raw = makeRawEvent({
    name: title,
    description: meta.description ?? meta["og:description"] ?? plainText.slice(0, 1000),
    startDate,
    endDate: meta["event:end_time"],
    city,
    category: `${title} ${pageUrl}`,
    url: meta["og:url"] ?? pageUrl,
    location: { name: addressMatch ? textContent(addressMatch[1]) : "", address: { addressLocality: city } },
  }, pageUrl, 0);
  return raw ? [raw] : [];
}

export function extractEventsFromHtml(html: string, pageUrl: string): RawEvent[] {
  const structured = jsonLdEvents(html, pageUrl);
  if (structured.length) return structured;
  const microdata = microdataFields(html);
  if (microdata) {
    const raw = makeRawEvent(microdata, pageUrl, 0);
    if (raw) return [raw];
  }
  const meta = metadata(html);
  const openGraphDate = meta["event:start_time"] ?? meta["og:event:start_time"];
  const openGraphTitle = meta["og:title"];
  if (openGraphTitle && openGraphDate) {
    const raw = makeRawEvent({ name: openGraphTitle, description: meta["og:description"], startDate: openGraphDate, city: meta["og:locality"], category: `${openGraphTitle} ${pageUrl}`, url: meta["og:url"] ?? pageUrl }, pageUrl, 0);
    if (raw) return [raw];
  }
  return candidateFromHtml(html, pageUrl);
}

export function extractInternalLinks(html: string, pageUrl: string, allowedHostname: string): { url: string; anchor: string }[] {
  const found = new Map<string, string>();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    const attrs = attributes(`<a ${match[1]}>`);
    if (!attrs.href) continue;
    try {
      const url = new URL(canonicalizeUrl(attrs.href, pageUrl));
      if (!/^https?:$/.test(url.protocol) || url.hostname.toLowerCase() !== allowedHostname.toLowerCase()) continue;
      if (/\.(?:jpg|jpeg|png|gif|webp|svg|mp4|mov|avi|zip|rar|7z|exe|dmg|pdf|docx?|xlsx?|pptx?)(?:$|\/)/i.test(url.pathname)) continue;
      found.set(url.toString(), textContent(match[2]).slice(0, 300));
    } catch { /* Ignore malformed links. */ }
  }
  return [...found].map(([url, anchor]) => ({ url, anchor }));
}

const EVENT_TERMS = ["event", "race", "marathon", "run", "running", "triathlon", "duathlon", "ultra", "trail", "cycling", "cycle", "bike", "hyrox", "hybrid", "adventure", "gravel", "walkathon", "crossfit", "ocr", "granfondo", "brm"];

export function scoreEventUrl(url: string, anchor = ""): number {
  const normalizedUrl = normalizeText(new URL(url).pathname);
  const normalizedAnchor = normalizeText(anchor);
  let score = 0;
  for (const term of EVENT_TERMS) {
    if (normalizedUrl.split(" ").includes(term)) score += 3;
    if (normalizedAnchor.split(" ").includes(term)) score += 2;
  }
  if (/\/(?:events?|races?)\//i.test(new URL(url).pathname)) score += 2;
  return score;
}

export function extractSitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi)].map((match) => decodeHtml(match[1].trim())).filter(Boolean);
}
