import { describe, expect, it } from 'vitest';
import { compositeChannel, rgbValues, selectCompositeFrames } from './composite.js';
import type { RenderFrame } from './resources.js';
const frame = (id: string, detector: string, hours: number, wavelengthUm: number) => ({ id, detector, wavelengthUm, observedAtUtc: new Date(Date.UTC(2025, 0, 1) + hours * 3600000).toISOString() }) as RenderFrame;
describe('temporal RGB composition', () => {
  it('uses all distinct detectors in a bounded period and orders actual wavelengths', () => {
    const frames = [frame('a', 'D1', 0, 1), frame('b', 'D2', 2, 2), frame('c', 'D3', 3, 3), frame('d', 'D4', 4, 4), frame('far', 'D5', 100, 5), frame('duplicate', 'D2', 1, 2)];
    expect(selectCompositeFrames(frames, frames[1]!.observedAtUtc, 4).map(f => f.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(selectCompositeFrames(frames, frames[0]!.observedAtUtc, .5)).toEqual([]);
    expect([0, 1, 2, 3, 4, 5].map(i => compositeChannel(i, 6))).toEqual([2, 2, 1, 1, 0, 0]);
  });
  it('does not mistake twice the allowed span for the same epoch', () => {
    const frames = [frame('a', 'D1', 0, 1), frame('b', 'D2', 20, 2), frame('c', 'D3', 40, 3)];
    const chosen = selectCompositeFrames(frames, frames[1]!.observedAtUtc, 24);
    expect(chosen).toHaveLength(2);
    expect(Math.max(...chosen.map(f => Date.parse(f.observedAtUtc))) - Math.min(...chosen.map(f => Date.parse(f.observedAtUtc)))).toBeLessThanOrEqual(24 * 3600000);
  });
});

it('switches RGB independently and supports repeated band assignments', () => {
  const channels = [{ enabled: true, detector: 'D1' }, { enabled: false, detector: 'auto' }, { enabled: true, detector: 'D1' }];
  expect(rgbValues([.2, .8], ['D1', 'D2'], channels)).toEqual([.2, 0, .2]);
  expect(rgbValues([.2, NaN], ['D1', 'D2'], channels)).toEqual([.2, 0, .2]);
  expect(rgbValues([.2, .8], ['D1', 'D2'], channels.map(channel => ({ ...channel, enabled: false })))).toEqual([0, 0, 0]);
  expect(rgbValues([.2, .8], ['D1', 'D2'], [{ enabled: true, detector: 'missing' }, ...channels.slice(1)])).toBeNull();
});
