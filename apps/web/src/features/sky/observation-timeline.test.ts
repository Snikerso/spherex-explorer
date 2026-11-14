import { describe, expect, it } from 'vitest';
import type { Observation } from '@spherex/contracts';
import { observationTimeline } from './observation-timeline';
const image = (id: string, detector: string, time: string): Observation => ({
  id,
  detector,
  observedAtUtc: time,
  comparisonGroup: detector,
});
describe('shared exposure timeline', () => {
  it('aligns bands by actual time rather than ordinal image position', () => {
    const columns = observationTimeline([
      image('b', 'D2', '2025-02-01T00:00:00Z'),
      image('a', 'D1', '2025-01-01T00:00:00Z'),
      image('c', 'D1', '2025-02-01T00:00:00Z'),
    ]);
    expect(columns).toHaveLength(2);
    expect(columns[0]!.bands.has('D2')).toBe(false);
    expect(columns[1]!.bands.get('D2')![0]!.id).toBe('b');
    expect(columns[1]!.bands.get('D1')![0]!.id).toBe('c');
  });
  it('normalizes equivalent UTC times and preserves multiple selectable images', () => {
    const columns = observationTimeline([
      image('a', 'D1', '2025-01-01T00:00:00Z'),
      image('b', 'D1', '2025-01-01T00:00:00.000Z'),
    ]);
    expect(columns).toHaveLength(1);
    expect(columns[0]!.bands.get('D1')).toHaveLength(2);
  });
  it('handles an empty dataset and ignores invalid times', () => {
    expect(observationTimeline([])).toEqual([]);
    expect(observationTimeline([image('a', 'D1', 'invalid')])).toEqual([]);
  });
});

it('uses the selected time window without chaining beyond its maximum span', () => {
  const rows = [
    image('a', 'D1', '2025-01-01T00:00:00Z'),
    image('b', 'D2', '2025-01-01T12:00:00Z'),
    image('c', 'D3', '2025-01-02T00:00:00Z'),
    image('d', 'D1', '2025-01-02T12:00:00Z'),
  ];
  const grouped = observationTimeline(rows, 24);
  expect(grouped).toHaveLength(2);
  expect(grouped[0]!.bands.has('D2')).toBe(true);
  expect(grouped[0]!.bands.has('D3')).toBe(true);
  expect(grouped[1]!.bands.has('D2')).toBe(false);
  expect(observationTimeline(rows, 1)).toHaveLength(4);
  expect(observationTimeline(rows, 72)).toHaveLength(1);
  expect(grouped.reduce((n, g) => n + [...g.bands.values()].flat().length, 0)).toBe(rows.length);
});
