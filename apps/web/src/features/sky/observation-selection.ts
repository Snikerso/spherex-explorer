import type { Observation } from '@spherex/contracts';

/** Keep the full date range in every detector; animation needs at least two images. */
export function sampleObservations(observations: Observation[], percent: number): string[] {
  const fraction = Math.min(100, Math.max(1, percent)) / 100;
  const groups = new Map<string, Observation[]>();
  for (const item of observations) {
    const group = groups.get(item.detector ?? '') ?? [];
    group.push(item);
    groups.set(item.detector ?? '', group);
  }
  return [...groups.values()].flatMap((items) => {
    const sorted = [...items].sort(
      (a, b) => a.observedAtUtc.localeCompare(b.observedAtUtc) || a.id.localeCompare(b.id),
    );
    const count = Math.min(sorted.length, Math.max(2, Math.round(sorted.length * fraction)));
    return Array.from(
      { length: count },
      (_, index) =>
        sorted[count === 1 ? 0 : Math.round((index * (sorted.length - 1)) / (count - 1))]!.id,
    );
  });
}
