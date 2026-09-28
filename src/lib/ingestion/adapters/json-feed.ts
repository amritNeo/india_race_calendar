import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { EventSourceAdapter, NormalizedEvent, RawEvent } from "../types";
import { normalizeFeedEvent } from "../normalization";

function isPrivateAddress(address: string): boolean {
  if (address.includes(":")) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7));
    return !/^[23]/.test(normalized) || normalized.startsWith("2001:db8") || normalized.startsWith("2001:10");
  }
  const parts = address.split(".").map(Number);
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && (parts[1] === 168 || parts[1] === 0 || parts[1] === 2)) || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) || (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) || (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) || parts[0] >= 224;
}

async function readLimitedJson(response: Response): Promise<unknown> {
  const maxBytes = 2 * 1024 * 1024;
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) throw new Error("JSON feed response exceeds the 2 MB limit.");
  if (!response.body) throw new Error("JSON feed response is empty.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new Error("JSON feed response exceeds the 2 MB limit."); }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(merged));
}

async function assertPublicHttps(urlText: string): Promise<URL> {
  const url = new URL(urlText);
  if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password) throw new Error("Source feed must use a public HTTPS URL.");
  if (isIP(url.hostname)) throw new Error("Source feed cannot use an IP address.");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Source feed hostname must resolve only to public addresses.");
  return url;
}

export class JsonFeedAdapter implements EventSourceAdapter {
  constructor(public sourceName: string, private readonly baseUrl: string) {}

  async discover(): Promise<RawEvent[]> {
    const url = await assertPublicHttps(this.baseUrl);
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000), redirect: "error", cache: "no-store" });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
    const body = await readLimitedJson(response);
    const items = Array.isArray(body) ? body : body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events) ? (body as { events: unknown[] }).events : null;
    if (!items) throw new Error("JSON feed must be an array or an object with an events array.");
    return items.filter((item): item is RawEvent => Boolean(item) && typeof item === "object" && !Array.isArray(item)).slice(0, 25);
  }

  async normalize(rawEvent: RawEvent): Promise<NormalizedEvent> { return normalizeFeedEvent(rawEvent); }
}
