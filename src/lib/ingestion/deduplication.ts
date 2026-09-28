import { normalizeText } from "./normalization";

export function nameSimilarity(left: string, right: string): number {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (a === b) return 1;
  if (!a || !b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row++) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column++) {
      const above = previous[column];
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + (a[row - 1] === b[column - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

export function duplicateConfidence(left: { name: string; cityId: string; startDate: Date }, right: { name: string; cityId: string; startDate: Date }): "HIGH" | "POSSIBLE" | null {
  if (left.cityId !== right.cityId || left.startDate.toISOString().slice(0, 10) !== right.startDate.toISOString().slice(0, 10)) return null;
  const similarity = nameSimilarity(left.name, right.name);
  return similarity >= 0.72 ? similarity >= 0.88 ? "HIGH" : "POSSIBLE" : null;
}

export function mergeEventDetails<T extends { registrationUrl: string | null; officialWebsiteUrl: string | null; sourceName: string | null; sourceUrl: string | null; description: string }>(canonical: T, other: T) {
  return {
    registrationUrl: canonical.registrationUrl ?? other.registrationUrl,
    officialWebsiteUrl: canonical.officialWebsiteUrl ?? other.officialWebsiteUrl,
    sourceName: canonical.sourceName ?? other.sourceName,
    sourceUrl: canonical.sourceUrl ?? other.sourceUrl,
    description: canonical.description || other.description,
  };
}

export type MergeDistance = { name: string; distanceKm: { toString(): string } | number | null; discipline: string; sequence: number };
export function mergeDistances<T extends MergeDistance>(canonical: T[], other: T[]): T[] {
  const existing = new Set(canonical.map((item) => `${item.name.toLowerCase()}|${item.distanceKm?.toString() ?? ""}|${item.discipline}`));
  return other.filter((item) => !existing.has(`${item.name.toLowerCase()}|${item.distanceKm?.toString() ?? ""}|${item.discipline}`));
}
