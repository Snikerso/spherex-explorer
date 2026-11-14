import { expect, it } from 'vitest';
import { gaiaPosition, type GaiaSource } from './catalogs.js';
const source: GaiaSource = {
  id: '4472831276235286400',
  raDeg: 359.999,
  decDeg: 0,
  epoch: 2016,
  pmra: 3600000,
  pmdec: 0,
  parallaxMas: 1,
  magnitude: 12,
};
it('propagates mu-alpha-star across RA zero without numerical pole singularities', () => {
  const point = gaiaPosition(source, '2017-01-01T12:00:00Z');
  expect(point.raDeg).toBeGreaterThan(0.99);
  expect(point.raDeg).toBeLessThan(1.01);
  expect(point.propagated).toBe(true);
  const pole = gaiaPosition({ ...source, decDeg: 90 }, '2025-01-01T00:00:00Z');
  expect(Number.isFinite(pole.raDeg)).toBe(true);
  expect(Number.isFinite(pole.decDeg)).toBe(true);
});
it('does not invent motion where one component is missing', () => {
  expect(gaiaPosition({ ...source, pmra: null }, '2025-01-01')).toEqual({
    raDeg: source.raDeg,
    decDeg: source.decDeg,
    propagated: false,
  });
});
