import type { EventSourceAdapter, NormalizedEvent, RawEvent } from "../types";

export class ManualEventAdapter implements EventSourceAdapter {
  sourceName = "Manual entry";
  async discover(): Promise<RawEvent[]> { return []; }
  async normalize(rawEvent: RawEvent): Promise<NormalizedEvent> {
    return rawEvent as unknown as NormalizedEvent;
  }
}
