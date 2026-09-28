import { describe, expect, it } from "vitest";
import { filterEvents, slugify, validateEvent } from "./domain";
import { demoEvents } from "./demo-data";

describe("event domain", () => {
  it("creates stable URL slugs", () => { expect(slugify("Pune International Marathon 2026")).toBe("pune-international-marathon-2026"); });
  it("filters by city and category", () => {
    const results = filterEvents(demoEvents, { city: "pune", category: "running" });
    expect(results.length).toBeGreaterThanOrEqual(6);
    expect(results.every((event) => event.city.slug === "pune" && event.category.parent?.slug === "running")).toBe(true);
  });
  it("filters by date range and search text", () => {
    const expected = demoEvents[0]!;
    expect(filterEvents(demoEvents, { from: expected.startDate.slice(0, 10), to: expected.startDate.slice(0, 10), search: expected.city.name }).some((event) => event.id === expected.id)).toBe(true);
  });
  it("validates required fields, URLs, date order and distance", () => {
    expect(validateEvent({ name: "", startDate: "2026-12-20", endDate: "2026-12-19", registrationUrl: "javascript:alert(1)", distances: [{ distanceKm: -1 }] })).toHaveLength(6);
  });
});
