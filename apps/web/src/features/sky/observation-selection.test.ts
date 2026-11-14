import { describe, expect, it } from 'vitest';
import type { Observation } from '@spherex/contracts';
import { sampleObservations } from './observation-selection';
const items: Observation[] = [1, 2].flatMap((band) =>
  Array.from({ length: 100 }, (_, i) => ({
    id: `${band}-${i}`,
    detector: `SPHEREx-D${band}`,
    observedAtUtc: new Date(Date.UTC(2025, 0, i + 1)).toISOString(),
    comparisonGroup: `D${band}`,
  })),
);
describe('dataset sampling', () => {
  it('includes every image at 100%', () =>
    expect(new Set(sampleObservations(items, 100))).toEqual(new Set(items.map((x) => x.id))));
  it('samples each band evenly across the full time range', () => {
    const ids = sampleObservations(items, 10);
    expect(ids).toHaveLength(20);
    for (const band of [1, 2]) {
      expect(ids).toContain(`${band}-0`);
      expect(ids).toContain(`${band}-99`);
    }
    expect(new Set(ids).size).toBe(20);
  });
  it('keeps the minimum pair for animation at 1%', () =>
    expect(sampleObservations(items, 1)).toEqual(['1-0', '1-99', '2-0', '2-99']));
  it('does not mutate input and handles an empty or single-image dataset', () => {
    expect(sampleObservations([], 10)).toEqual([]);
    expect(sampleObservations(items.slice(0, 1), 1)).toEqual(['1-0']);
    sampleObservations(items.slice().reverse(), 20);
    expect(items[0]!.id).toBe('1-0');
  });
});
