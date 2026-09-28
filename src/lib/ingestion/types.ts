export type RawEvent = {
  externalId?: string;
  sourceUrl?: string;
  [key: string]: unknown;
};

export type NormalizedEvent = {
  name: string;
  description: string;
  startDate: string;
  endDate?: string | null;
  city: string;
  category: string;
  venue?: string;
  organizer?: string;
  registrationUrl?: string;
  officialWebsiteUrl?: string;
  distances?: { name: string; distanceKm?: number | null; discipline?: "RUN" | "BIKE" | "SWIM" | "WALK" | "ROW" | "OTHER" }[];
};

export interface EventSourceAdapter {
  sourceName: string;
  discover(): Promise<RawEvent[]>;
  normalize(rawEvent: RawEvent): Promise<NormalizedEvent>;
  getRunMetadata?(): { robotsStatus?: "ALLOWED" | "DISALLOWED" | "UNKNOWN"; robotsReason?: string };
}
