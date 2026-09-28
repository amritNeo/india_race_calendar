import type { EventSourceType } from "@/generated/prisma/client";
import type { EventSourceAdapter } from "./types";
import { JsonFeedAdapter } from "./adapters/json-feed";
import { ManualEventAdapter } from "./adapters/manual";

export function adapterFor(source: { name: string; type: EventSourceType; baseUrl: string | null }): EventSourceAdapter {
  if (source.type === "MANUAL") return new ManualEventAdapter();
  if ((source.type === "WEB" || source.type === "API") && source.baseUrl) return new JsonFeedAdapter(source.name, source.baseUrl);
  throw new Error(`Source ${source.name} has no supported adapter or feed URL.`);
}
