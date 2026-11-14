import { describe, expect, it } from 'vitest';
import { cutoutUrl, safeSourceUrl, parseSia } from '../src/modules/observations/irsa.js';
const source = 'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W19_1B/l2b-v27-2026-197/1/frame.fits';
const input = { raDeg: 133.79512917, decDeg: -7.24514722, fovDeg: .1, fromUtc: null, toUtc: null, release: 'dr1' as const };
describe('IRSA cutout protocol', () => {
  it('preserves a literal comma because the archive rejects an encoded center separator', () => {
    expect(cutoutUrl(source, input).toString()).toBe(`${source}?center=133.79512917,-7.24514722&size=0.1`);
  });
  it('accepts only archive FITS products and validated numeric regions', () => {
    for (const invalid of ['http://irsa.ipac.caltech.edu/a.fits', 'https://example.com/a.fits', `${source}?size=9`, source.replace('/ibe/data/', '/other/')]) expect(() => safeSourceUrl(invalid)).toThrow();
    expect(() => cutoutUrl(source, { ...input, fovDeg: 3 })).toThrow();
  });
  it('rejects products from a different release instead of mixing calibrations', () => {
    const names = ['access_url', 't_min', 'obs_id', 'energy_bandpassname', 'em_min', 'em_max', 'dataproduct_type'];
    const data = { VOTABLE: { RESOURCE_ARRAY: [{ TABLE: { FIELD_ARRAY: names.map(name => ({ '<xmlattr>': { name } })), DATA: { TABLEDATA: [[source.replace('/dr1/', '/qr3/'), '60000', 'source', 'SPHEREx-D1', '.000001', '.000002', 'image']] } } }] } };
    expect(() => parseSia(data, 'dr1')).toThrow('innego wydania');
  });

});
