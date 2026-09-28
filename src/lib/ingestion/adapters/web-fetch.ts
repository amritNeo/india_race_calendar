import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";

const USER_AGENT = "IndiaRaceCalendarBot/1.0 (+public event discovery; respectful crawler)";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const lastRequestByHost = new Map<string, number>();
const requestQueueByHost = new Map<string, Promise<void>>();

export class WebsiteAccessBlockedError extends Error {
  constructor(message: string) { super(message); this.name = "WebsiteAccessBlockedError"; }
}

export function canonicalizeUrl(input: string, base?: string): string {
  const url = new URL(input, base);
  url.hash = "";
  const trackingKeys = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"]);
  const entries = [...url.searchParams.entries()]
    .filter(([key]) => !trackingKeys.has(key.toLowerCase()))
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue));
  url.search = "";
  for (const [key, value] of entries) url.searchParams.append(key, value);
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = octets;
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 192 && b === 88 && c === 99)
    || (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100))
    || (a === 203 && b === 0 && c === 113)
    || a === 255);
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%", 1)[0];
  // Only globally routable unicast (2000::/3) is accepted. This excludes
  // loopback, mapped IPv4, ULA, link-local, multicast, and unspecified ranges.
  if (!/^[23]/.test(normalized)) return false;
  return !normalized.startsWith("2001:db8")
    && !normalized.startsWith("2001:0:")
    && !normalized.startsWith("2001:10:")
    && !normalized.startsWith("2001:20:")
    && !normalized.startsWith("2002:");
}

export function isPublicIpAddress(address: string): boolean {
  const version = isIP(address);
  return version === 4 ? isPublicIpv4(address) : version === 6 ? isPublicIpv6(address) : false;
}

type ResolvedAddress = { address: string; family: 4 | 6 };

async function resolvePublicAddress(hostname: string): Promise<ResolvedAddress> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host === "metadata.google.internal") {
    throw new WebsiteAccessBlockedError("Private or local network destinations are not allowed.");
  }
  const version = isIP(host);
  if (version) {
    if (!isPublicIpAddress(host)) throw new WebsiteAccessBlockedError("Private or non-routable IP addresses are not allowed.");
    return { address: host, family: version as 4 | 6 };
  }
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new WebsiteAccessBlockedError("The website hostname must resolve only to public IP addresses.");
  }
  const selected = addresses[0];
  return { address: selected.address, family: selected.family as 4 | 6 };
}

export type TextFetchOptions = {
  url: string;
  allowedHostname: string;
  accept: string;
  allowedContentTypes: string[];
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  crawlDelayMs?: number;
  allowNotFound?: boolean;
  isRobotsAllowed?: (url: string) => boolean;
};

export type TextFetchResult = { url: string; status: number; contentType: string; body: string; headers: http.IncomingHttpHeaders };

function hostAllowed(hostname: string, allowedHostname: string): boolean {
  return hostname.toLowerCase() === allowedHostname.toLowerCase();
}

async function waitForHost(host: string, crawlDelayMs: number): Promise<void> {
  const previous = requestQueueByHost.get(host) ?? Promise.resolve();
  let release = () => {};
  const slot = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => slot);
  requestQueueByHost.set(host, tail);
  await previous;
  const minimumDelay = Math.max(400, crawlDelayMs);
  try {
    const now = Date.now();
    const waitMs = Math.max(0, (lastRequestByHost.get(host) ?? 0) + minimumDelay - now);
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastRequestByHost.set(host, Date.now());
  } finally {
    release();
    if (requestQueueByHost.get(host) === tail) requestQueueByHost.delete(host);
  }
}

async function requestOnce(url: URL, options: TextFetchOptions): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  const address = await resolvePublicAddress(url.hostname);
  await waitForHost(url.hostname, options.crawlDelayMs ?? 400);
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.get(url, {
      headers: { "user-agent": USER_AGENT, accept: options.accept, "accept-encoding": "identity" },
      timeout: options.timeoutMs ?? 8_000,
      // Pin the socket to the public address that was validated above, so DNS
      // rebinding cannot change the destination between validation and connect.
      lookup: (_hostname, lookupOptions, callback) => {
        if (lookupOptions && typeof lookupOptions === "object" && "all" in lookupOptions && lookupOptions.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.byteLength;
        if (total > options.maxBytes) {
          response.destroy(new Error(`Response exceeds the ${options.maxBytes} byte limit.`));
          return;
        }
        chunks.push(buffer);
      });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Website request timed out.")));
    req.on("error", reject);
  });
}

export async function fetchPublicText(options: TextFetchOptions): Promise<TextFetchResult> {
  let current = new URL(options.url);
  const allowedHostname = options.allowedHostname.toLowerCase();
  const maxRedirects = options.maxRedirects ?? 5;
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    if (!(current.protocol === "http:" || current.protocol === "https:") || current.username || current.password || !hostAllowed(current.hostname, allowedHostname)) {
      throw new WebsiteAccessBlockedError("Website redirect left the configured public domain or used a forbidden protocol.");
    }
    if (options.isRobotsAllowed && !options.isRobotsAllowed(current.toString())) throw new RobotsDisallowedError(current.toString());
    // Resolve on every hop. requestOnce pins the actual socket to that result.
    await resolvePublicAddress(current.hostname);
    let result: Awaited<ReturnType<typeof requestOnce>> | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await requestOnce(current, options);
        if ((result.status === 429 || result.status >= 500) && attempt === 0) {
          const retryAfter = Number(result.headers["retry-after"]);
          await new Promise((resolve) => setTimeout(resolve, Math.min(5_000, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * (2 ** attempt))));
          continue;
        }
        break;
      } catch (error) {
        if (error instanceof WebsiteAccessBlockedError || error instanceof RobotsDisallowedError) throw error;
        if (attempt === 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
      }
    }
    if (!result) throw new Error("Website request failed.");
    if (REDIRECT_STATUSES.has(result.status)) {
      const location = result.headers.location;
      if (!location) throw new Error(`Website returned HTTP ${result.status} without a redirect target.`);
      if (redirects === maxRedirects) throw new Error("Website exceeded the redirect limit.");
      current = new URL(location, current);
      continue;
    }
    if ([401, 403, 429].includes(result.status)) throw new WebsiteAccessBlockedError(`Website returned HTTP ${result.status}.`);
    if (result.status === 404 && options.allowNotFound) return { url: current.toString(), status: result.status, contentType: "", body: "", headers: result.headers };
    if (result.status < 200 || result.status >= 300) throw new Error(`Website returned HTTP ${result.status}.`);
    const contentType = String(result.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
    if (!options.allowedContentTypes.includes(contentType)) throw new Error(`Unsupported website content type: ${contentType || "missing"}.`);
    return { url: current.toString(), status: result.status, contentType, body: result.body.toString("utf8"), headers: result.headers };
  }
  throw new Error("Website redirect handling failed.");
}

export class RobotsDisallowedError extends Error {
  constructor(public url: string) { super(`robots.txt disallows ${new URL(url).pathname}.`); this.name = "RobotsDisallowedError"; }
}
