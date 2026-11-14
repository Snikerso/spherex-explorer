import { expect, it } from 'vitest';
import { recordedEarthPosition, type RecordedSpacecraft } from './recorded-orbit';
it('places archived positions at the FITS ground track and preserves geocentric distance', () => {
  const observation: RecordedSpacecraft = {
    latitudeDeg: 0,
    longitudeDeg: 90,
    radiusKm: 7000,
    speedKmS: 7.5,
    observedAtUtc: '2025-07-01T12:00:00Z',
    method: 'fixture',
  };
  const east = recordedEarthPosition(observation);
  expect(east.x).toBeCloseTo(0, 10);
  expect(east.y).toBe(7000);
  expect(east.z).toBe(0);
  const north = recordedEarthPosition({ ...observation, latitudeDeg: 90 });
  expect(north.z).toBe(7000);
  expect(Math.hypot(north.x, north.y, north.z)).toBe(7000);
  expect(recordedEarthPosition({ ...observation, longitudeDeg: -90 }).y).toBe(-7000);
});

import { recordedOrbit } from './recorded-orbit';
const circular: RecordedSpacecraft = {
  latitudeDeg: 25,
  longitudeDeg: 140,
  radiusKm: 7000,
  speedKmS: Math.sqrt(398600.4418 / 7000),
  observedAtUtc: '2025-07-01T12:00:00Z',
  method: 'fixture',
  inertialPositionKm: { x: 7000, y: 0, z: 0 },
  inertialVelocityKmS: { x: 0, y: Math.sqrt(398600.4418 / 7000), z: 0 },
};
it('anchors the fitted orbit to the measured position and closes it in one Earth orientation', () => {
  const fitted = recordedOrbit(circular, new Date(circular.observedAtUtc))!;
  const anchor = recordedEarthPosition(circular);
  expect(fitted.estimated).toBe(false);
  expect(
    Math.hypot(
      fitted.position.x - anchor.x,
      fitted.position.y - anchor.y,
      fitted.position.z - anchor.z,
    ),
  ).toBeLessThan(1e-8);
  expect(fitted.track[96]).toEqual(fitted.position);
  const first = fitted.track[0]!,
    last = fitted.track.at(-1)!;
  expect(Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z)).toBeLessThan(1e-7);
  expect(fitted.periodMinutes).toBeGreaterThan(95);
  expect(fitted.periodMinutes).toBeLessThan(100);
  for (const point of fitted.track)
    expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(7000, 7);
});
it('advances the satellite along its fitted orbit and keeps it on the displayed curve', () => {
  const future = new Date(Date.parse(circular.observedAtUtc) + 600000);
  const fitted = recordedOrbit(circular, future)!;
  expect(fitted.estimated).toBe(true);
  expect(fitted.track[96]).toEqual(fitted.position);
  const anchor = recordedEarthPosition(circular);
  expect(
    Math.hypot(
      fitted.position.x - anchor.x,
      fitted.position.y - anchor.y,
      fitted.position.z - anchor.z,
    ),
  ).toBeGreaterThan(1000);
});
it('does not draw impossible or unsupported trajectories', () => {
  const epoch = new Date(circular.observedAtUtc);
  expect(recordedOrbit({ ...circular, inertialVelocityKmS: null }, epoch)).toBeNull();
  expect(
    recordedOrbit({ ...circular, inertialVelocityKmS: { x: 0, y: 1, z: 0 } }, epoch),
  ).toBeNull();
  expect(recordedOrbit(circular, new Date(epoch.getTime() + 24 * 3600000))).toBeNull();
});
