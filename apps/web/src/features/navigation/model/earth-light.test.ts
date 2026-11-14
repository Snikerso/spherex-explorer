import { expect, it } from 'vitest';
import { earthShadow, shadowAlpha } from './earth-light';

it('puts darkness opposite the Sun and twilight at the terminator', () => {
  expect(shadowAlpha(1)).toBe(0);
  expect(shadowAlpha(-1)).toBe(0.9);
  expect(shadowAlpha(0)).toBeGreaterThan(shadowAlpha(0.1));
  expect(shadowAlpha(0)).toBeLessThan(shadowAlpha(-0.1));
});

it('lights the matching hemisphere, including Sun in front and behind the camera', () => {
  const size = 101,
    center = (50 * size + 50) * 4 + 3;
  const left = (50 * size + 15) * 4 + 3,
    right = (50 * size + 85) * 4 + 3;
  const east = earthShadow(size, { x: 1, y: 0, z: 0 });
  const west = earthShadow(size, { x: -1, y: 0, z: 0 });
  expect(east[right]).toBeLessThan(east[left]!);
  expect(west[right]).toBeGreaterThan(west[left]!);
  expect(east[left]).toBe(west[right]);
  expect(earthShadow(size, { x: 0, y: 0, z: 1 })[center]).toBe(0);
  expect(earthShadow(size, { x: 0, y: 0, z: -1 })[center]).toBe(230);
  expect(east[3]).toBe(0); // Outside globe is transparent.
});
