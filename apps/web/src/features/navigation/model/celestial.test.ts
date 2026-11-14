import { expect, it } from 'vitest';
import { celestialPositions } from './celestial';

it('returns finite unit Earth-fixed directions and physical geocentric distances', () => {
  const bodies = celestialPositions(new Date('2026-11-14T12:00:00Z'));
  expect(bodies.map((body) => body.name)).toEqual(['Słońce', 'Księżyc']);
  for (const { direction } of bodies)
    expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 12);
  expect(bodies[0]!.distanceKm).toBeGreaterThan(140e6);
  expect(bodies[0]!.distanceKm).toBeLessThan(160e6);
  expect(bodies[1]!.distanceKm).toBeGreaterThan(350000);
  expect(bodies[1]!.distanceKm).toBeLessThan(410000);
});

it('rotates the Sun with Earth-fixed time and keeps repeated calculations deterministic', () => {
  const date = new Date('2026-11-14T12:00:00Z');
  const before = celestialPositions(date);
  expect(celestialPositions(date)).toEqual(before);
  const after = celestialPositions(new Date(date.getTime() + 3600000));
  const longitude = (v: { x: number; y: number }) => Math.atan2(v.y, v.x);
  const change =
    (Math.atan2(
      Math.sin(longitude(after[0]!.direction) - longitude(before[0]!.direction)),
      Math.cos(longitude(after[0]!.direction) - longitude(before[0]!.direction)),
    ) *
      180) /
    Math.PI;
  expect(change).toBeGreaterThan(-16);
  expect(change).toBeLessThan(-14);
});
