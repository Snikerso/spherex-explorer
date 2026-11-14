import { describe, expect, it, vi } from 'vitest';
import {
  cutoutUrl,
  safeSourceUrl,
  parseSia,
  IrsaClient,
} from '../src/modules/observations/irsa.js';
const source =
  'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W19_1B/l2b-v27-2026-197/1/frame.fits';
const input = {
  raDeg: 133.79512917,
  decDeg: -7.24514722,
  fovDeg: 0.1,
  fromUtc: null,
  toUtc: null,
  release: 'dr1' as const,
};
describe('IRSA cutout protocol', () => {
  it('preserves a literal comma because the archive rejects an encoded center separator', () => {
    expect(cutoutUrl(source, input).toString()).toBe(
      `${source}?center=133.79512917,-7.24514722&size=0.1`,
    );
  });
  it('accepts only archive FITS products and validated numeric regions', () => {
    for (const invalid of [
      'http://irsa.ipac.caltech.edu/a.fits',
      'https://example.com/a.fits',
      `${source}?size=9`,
      source.replace('/ibe/data/', '/other/'),
    ])
      expect(() => safeSourceUrl(invalid)).toThrow();
    expect(() => cutoutUrl(source, { ...input, fovDeg: 3 })).toThrow();
  });
  it('rejects products from a different release instead of mixing calibrations', () => {
    const names = [
      'access_url',
      't_min',
      'obs_id',
      'energy_bandpassname',
      'em_min',
      'em_max',
      'dataproduct_type',
    ];
    const data = {
      VOTABLE: {
        RESOURCE_ARRAY: [
          {
            TABLE: {
              FIELD_ARRAY: names.map((name) => ({ '<xmlattr>': { name } })),
              DATA: {
                TABLEDATA: [
                  [
                    source.replace('/dr1/', '/qr3/'),
                    '60000',
                    'source',
                    'SPHEREx-D1',
                    '.000001',
                    '.000002',
                    'image',
                  ],
                ],
              },
            },
          },
        ],
      },
    };
    expect(() => parseSia(data, 'dr1')).toThrow('innego wydania');
  });
});

const fields = [
  'access_url',
  't_min',
  'obs_id',
  'energy_bandpassname',
  'em_min',
  'em_max',
  'dataproduct_type',
];
const table = {
  FIELD_ARRAY: fields.map((name) => ({ '<xmlattr>': { name } })),
  DATA: { TABLEDATA: [[source, '60000', 'source', 'SPHEREx-D1', '.000001', '.000002', 'image']] },
};
it('retries a temporary archive failure and keeps the same FOV parameters', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ VOTABLE: { RESOURCE_ARRAY: [{ TABLE: table }] } })),
    );
  const rows = await new IrsaClient(request).search({ ...input, fovDeg: 0.5 });
  expect(rows).toHaveLength(1);
  expect(request).toHaveBeenCalledTimes(2);
  expect((request.mock.calls[0]![0] as URL).searchParams.get('POS')).toBe(
    `CIRCLE ${input.raDeg} ${input.decDeg} ${0.5 / Math.sqrt(2)}`,
  );
  expect(String(request.mock.calls[0]![0])).toBe(String(request.mock.calls[1]![0]));
});
it('does not convert archive errors or overflow outside the table resource into empty results', () => {
  for (const value of ['ERROR', 'OVERFLOW'])
    expect(() =>
      parseSia(
        {
          VOTABLE: {
            RESOURCE_ARRAY: [
              { TABLE: table },
              { INFO_ARRAY: [{ '<xmlattr>': { name: 'QUERY_STATUS', value } }] },
            ],
          },
        },
        'dr1',
      ),
    ).toThrow();
});
it('never retries a user-cancelled request', async () => {
  const abort = new AbortController();
  abort.abort();
  const request = vi.fn().mockRejectedValue(abort.signal.reason);
  await expect(new IrsaClient(request).search(input, abort.signal)).rejects.toThrow();
  expect(request).toHaveBeenCalledOnce();
});
