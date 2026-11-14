import type { Observation } from '@spherex/contracts';

/** Keep the full date range in every detector; animation needs at least two images. */
export function sampleObservations(
  observations: Observation[],
  percent: number,
  limit = Infinity,
): string[] {
  const fraction = Math.min(100, Math.max(1, percent)) / 100;
  const groups = new Map<string, Observation[]>();
  for (const item of observations) {
    const group = groups.get(item.detector ?? '') ?? [];
    group.push(item);
    groups.set(item.detector ?? '', group);
  }
  const sortedGroups = [...groups.values()].map((items) =>
    [...items].sort(
      (a, b) => a.observedAtUtc.localeCompare(b.observedAtUtc) || a.id.localeCompare(b.id),
    ),
  );
  const counts = sortedGroups.map((items) =>
    Math.min(items.length, Math.max(2, Math.round(items.length * fraction))),
  );
  while (counts.reduce((sum, count) => sum + count, 0) > limit) {
    const largest = counts.indexOf(Math.max(...counts));
    if (counts[largest]! <= 0) break;
    counts[largest]!--;
  }
  return sortedGroups.flatMap((sorted, group) =>
    Array.from(
      { length: counts[group]! },
      (_, index) =>
        sorted[
          counts[group] === 1 ? 0 : Math.round((index * (sorted.length - 1)) / (counts[group]! - 1))
        ]!.id,
    ),
  );
}
