import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import wiseSia from './fixtures/wise-sia.json' with { type: 'json' };
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { parseGaiaCsv, queryGaia } from '../src/modules/catalogs/gaia.js';
import { parseWiseSia } from '../src/modules/catalogs/wise.js';
vi.mock('../src/modules/observations/imaging/paths.js', async () => {
  const fs = await import('node:fs/promises'),
    os = await import('node:os'),
    path = await import('node:path');
  return {
    cacheRoot: await fs.mkdtemp(path.join(os.tmpdir(), 'spherex-catalog-tests-')),
    projectRoot: '/unused-in-catalog-tests',
  };
});
const testRoot = (await import('../src/modules/observations/imaging/paths.js')).cacheRoot;
afterAll(() => rm(testRoot, { recursive: true, force: true }));
const header = 'source_id,ra,dec,ref_epoch,pmra,pmdec,parallax,phot_g_mean_mag';
afterEach(async () => {
  await rm(join(testRoot, 'fits'), { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('preserves 64-bit Gaia IDs and missing measurements', () => {
  const data = parseGaiaCsv(`${header}\n4472831276235286401,269.4,4.6,2016,,,1.2,18.3\n`, 0.1);
  expect(data.sources[0]?.id).toBe('4472831276235286401');
  expect(data.sources[0]?.pmra).toBeNull();
  expect(data.sources[0]?.magnitude).toBe(18.3);
  expect(() => parseGaiaCsv('error document', 0.1)).toThrow();
});
it('marks truncation and keeps only 300 rows', () => {
  const data = parseGaiaCsv(
    [header, ...Array.from({ length: 301 }, (_, i) => `${i},10,20,2016,0,0,,10`)].join('\n'),
    0.1,
  );
  expect(data.truncated).toBe(true);
  expect(data.sources).toHaveLength(300);
});
it('queries only the fixed Gaia TAP service and reports outages', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(`${header}\n`));
  vi.stubGlobal('fetch', fetcher);
  await queryGaia(10, 20, 0.1);
  const url = fetcher.mock.calls[0]![0] as URL;
  expect(url.origin).toBe('https://gea.esac.esa.int');
  expect(url.searchParams.get('QUERY')).toContain('gaiadr3.gaia_source');
  fetcher.mockResolvedValue(new Response('down', { status: 503 }));
  await expect(queryGaia(10, 20, 0.1)).rejects.toThrow('temporarily unavailable');
});
it('selects real AllWISE intensity products, excludes noise/artifacts and rejects foreign URLs', () => {
  const products = parseWiseSia(wiseSia, 'W1');
  expect(products).toHaveLength(1);
  expect(products[0]?.sourceUrl).toContain('2688p045_ac51-w1-int-3.fits');
  expect(products[0]?.timeStart).toContain('2010-');
  expect(parseWiseSia(wiseSia, 'W2')[0]?.sourceUrl).toContain('-w2-int-3.fits');
  const changed = JSON.stringify(wiseSia).replaceAll(
    'https://irsa.ipac.caltech.edu/ibe/data/wise/',
    'https://example.com/ibe/data/wise/',
  );
  expect(() => parseWiseSia(JSON.parse(changed), 'W1')).toThrow('Invalid AllWISE');
  expect(() => parseWiseSia({}, 'W1')).toThrow();
});

it('parses CADC coverage and keeps absent epochs explicit', async () => {
  const { parseNeossat } = await import('../src/modules/catalogs/neossat.js');
  const result = parseNeossat(
    'obs_id\tobs_collection\tt_min\tt_max\tobs_publisher_did\nexample\tNEOSSAT\t55210\t\tcaom:NEOSSAT/example/product',
  );
  expect(result.observations[0]?.from).toContain('2010-');
  expect(result.observations[0]?.to).toBeNull();
  expect(result.observations[0]?.dataLink).toContain('ID=caom%3ANEOSSAT%2Fexample%2Fproduct');
  expect(() =>
    parseNeossat(
      'obs_id\tobs_collection\tt_min\tt_max\tobs_publisher_did\nx\tOTHER\t1\t2\thttps://example.com',
    ),
  ).toThrow();
});

it.each([
  { compressed: false, retry: false },
  { compressed: true, retry: false },
  { compressed: true, retry: true },
])('downloads AllWISE, renders and removes temporary files (%j)', async ({ compressed, retry }) => {
  const { queryWise } = await import('../src/modules/catalogs/wise.js');
  const worker = await import('../src/modules/observations/imaging/worker-runner.js');
  const { readFile, access } = await import('node:fs/promises');
  let manifestPath = '';
  const grid = { width: 256, height: 256, raDeg: 269.45, decDeg: 4.6, pixelScaleDeg: 0.001 };
  vi.spyOn(worker, 'renderReference').mockImplementation(async (path) => {
    manifestPath = path;
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    expect(manifest.grid).toEqual(grid);
    expect((await readFile(manifest.path)).toString()).toBe('SIMPLE fake fits');
    return { image: 'data:image/png;base64,test', timeStart: null, timeEnd: null };
  });
  const table = JSON.stringify(wiseSia);
  const fetcher = vi.fn();
  if (retry) fetcher.mockResolvedValueOnce(new Response('busy', { status: 503 }));
  fetcher
    .mockResolvedValueOnce(new Response(table))
    .mockResolvedValueOnce(
      new Response(compressed ? gzipSync('SIMPLE fake fits') : 'SIMPLE fake fits'),
    );
  vi.stubGlobal('fetch', fetcher);
  const result = await queryWise(grid, 'W1');
  expect(result.sourceUrl).toBe(
    'https://irsa.ipac.caltech.edu/ibe/data/wise/allwise/p3am_cdd/26/2688/2688p045_ac51/2688p045_ac51-w1-int-3.fits',
  );
  expect(fetcher.mock.calls[retry ? 2 : 1]![0]).toContain('center=269.45,4.6');
  await expect(access(manifestPath)).rejects.toThrow();
});
