import { describe, expect, it } from "vitest";
import { fallbackExternalId, normalizeCategory, normalizeText, splitLocation } from "./normalization";
import { duplicateConfidence, mergeDistances, mergeEventDetails, nameSimilarity } from "./deduplication";
import { validateEvent } from "../domain";

describe("ingestion normalization", () => {
  it("normalizes case and punctuation in locations", () => {
    expect(normalizeText("Pune")).toBe(normalizeText("PUNE"));
    expect(splitLocation("Pune, Maharashtra")).toEqual({ city: "Pune", state: "Maharashtra" });
    expect(normalizeText("Pimpri-Chinchwad")).toBe(normalizeText("Pimpri Chinchwad"));
  });

  it.each([
    ["21K", "half-marathon"], ["21.1 KM", "half-marathon"], ["HM", "half-marathon"],
    ["42.195K", "marathon"], ["42K", "marathon"], ["70.3", "triathlon"], ["Ironman 70.3", "70-3"],
    ["10K", "10k"], ["5K", "5k"], ["Trail Ultra", "ultra"], ["MTB", "mtb"],
    ["Gravel Gran Fondo", "gran-fondo"], ["BRM 200", "brm"], ["HYROX", "hyrox"], ["CrossFit competition", "crossfit-competition"],
  ])("maps %s to %s", (input, expected) => {
    expect(normalizeCategory(input)).toBe(expected);
  });

  it("finds likely duplicates using name, date, and city", () => {
    expect(nameSimilarity("Pune International Marathon 2026", "Pune International Marathon - 2026")).toBeGreaterThan(0.88);
    expect(duplicateConfidence({ name: "Pune International Marathon 2026", cityId: "pune", startDate: new Date("2026-12-13T00:00:00Z") }, { name: "Pune International Marathon - 2026", cityId: "pune", startDate: new Date("2026-12-13T00:00:00Z") })).toBe("HIGH");
    expect(duplicateConfidence({ name: "Pune Marathon", cityId: "pune", startDate: new Date("2026-12-13T00:00:00Z") }, { name: "Pune Marathon", cityId: "mumbai", startDate: new Date("2026-12-13T00:00:00Z") })).toBeNull();
  });

  it("creates a stable idempotency fingerprint per source", () => {
    const event = { name: "Pune Marathon", startDate: "2026-12-13", city: "PUNE", sourceSlug: "feed-one" };
    expect(fallbackExternalId(event)).toBe(fallbackExternalId({ ...event, city: "Pune" }));
    expect(fallbackExternalId(event)).not.toBe(fallbackExternalId({ ...event, sourceSlug: "feed-two" }));
  });

  it("preserves useful canonical fields and adds missing event data during a merge", () => {
    expect(mergeEventDetails({ registrationUrl: null, officialWebsiteUrl: "https://official.example", sourceName: "Primary", sourceUrl: null, description: "" }, { registrationUrl: "https://register.example", officialWebsiteUrl: null, sourceName: "Other", sourceUrl: "https://source.example", description: "Details" })).toEqual({ registrationUrl: "https://register.example", officialWebsiteUrl: "https://official.example", sourceName: "Primary", sourceUrl: "https://source.example", description: "Details" });
    expect(mergeDistances([{ name: "10K", distanceKm: 10, discipline: "RUN", sequence: 0 }], [{ name: "10K", distanceKm: 10, discipline: "RUN", sequence: 1 }, { name: "Half Marathon", distanceKm: 21.1, discipline: "RUN", sequence: 2 }])).toHaveLength(1);
  });

  it("rejects impossible calendar dates and malformed URLs", () => {
    expect(validateEvent({ name: "Run", cityId: "1", categoryId: "1", startDate: "2026-02-31", registrationUrl: "https://" })).toContain("A valid start date is required.");
    expect(validateEvent({ name: "Run", cityId: "1", categoryId: "1", startDate: "2026-12-13", sourceUrl: "javascript:alert(1)" })).toContain("Source URL must be a valid HTTP or HTTPS URL.");
  });
});
