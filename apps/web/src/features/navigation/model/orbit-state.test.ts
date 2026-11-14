import { expect, it } from 'vitest';
import { buildOrbitState } from './orbit-state';

it('keeps the center of the displayed track exactly at the current fallback position', () => {
  const state = buildOrbitState({
    clock: Date.parse('2026-11-14T12:00:00Z'),
    offset: 30,
    orbit: null,
    recorded: null,
    running: false,
  });
  expect(state.date.toISOString()).toBe('2026-11-14T12:30:00.000Z');
  expect(state.real).toBe(false);
  expect(state.track[48]).toEqual(state.ecf);
  expect(state.track).toHaveLength(97);
});
it('does not claim a predicted orbit for an archival point without a velocity vector', () => {
  const state = buildOrbitState({
    clock: Date.parse('2025-08-18T12:00:00Z'),
    offset: 0,
    orbit: null,
    running: false,
    recorded: {
      latitudeDeg: 0,
      longitudeDeg: 90,
      radiusKm: 7000,
      speedKmS: null,
      observedAtUtc: '2025-08-18T12:00:00Z',
      method: 'fixture',
    },
  });
  expect(state.recorded).toBe(true);
  expect(state.period).toBeNull();
  expect(state.track).toEqual([]);
  expect(state.ecf.y).toBe(7000);
  expect(state.speed).toBeNull();
});
