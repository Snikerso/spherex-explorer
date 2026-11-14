import { describe, expect, it } from 'vitest';
import { pixelToSky, skyToPixel } from './sky.js';
describe('north-up, east-left TAN image coordinates', () => {
  const grid = { width: 256, height: 256, raDeg: 359.99, decDeg: 66.759139, pixelScaleDeg: .1 / 256 };
  it('places the reference coordinate between the central four pixels', () => {
    expect(pixelToSky(grid, 127.5, 127.5).raDeg).toBeCloseTo(grid.raDeg, 9);
    expect(pixelToSky(grid, 127.5, 127.5).decDeg).toBeCloseTo(grid.decDeg, 9);
    expect(pixelToSky(grid, 127.5, 0).decDeg).toBeGreaterThan(grid.decDeg);
  });
  it('round trips edge pixels across RA=0 at high declination', () => {
    for (const [x, y] of [[0, 0], [255, 0], [255, 255], [0, 255], [42.3, 101.8]]) {
      const point = pixelToSky(grid, x!, y!); expect(point.raDeg).toBeGreaterThanOrEqual(0); expect(point.raDeg).toBeLessThan(360);
      const pixel = skyToPixel(grid, point)!; expect(pixel.x).toBeCloseTo(x!, 7); expect(pixel.y).toBeCloseTo(y!, 7);
    }
  });
  it('rejects points behind the tangent plane', () => { expect(skyToPixel(grid, { raDeg: 179.99, decDeg: -66.759139 })).toBeNull(); });
});
