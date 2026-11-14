import { expect, it } from 'vitest';
import { skyDirection, earthIntersection } from './navigation.js';
it('maps equatorial coordinates onto the correct inertial axes', () => {
  expect(skyDirection(0, 0)).toEqual({ x: 1, y: 0, z: 0 });
  expect(skyDirection(90, 0).y).toBeCloseTo(1);
  expect(skyDirection(271, 90).z).toBeCloseTo(1);
  expect(skyDirection(25, -90).z).toBeCloseTo(-1);
  expect(Math.hypot(...Object.values(skyDirection(133, -7)))).toBeCloseTo(1);
});
it('distinguishes an Earth-blocked line of sight from a clear direction', () => {
  expect(earthIntersection({ x: 7000, y: 0, z: 0 }, { x: -1, y: 0, z: 0 })).toBeCloseTo(621.863);
  expect(earthIntersection({ x: 7000, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeNull();
  expect(earthIntersection({ x: 7000, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeNull();
});
