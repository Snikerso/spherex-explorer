import { fitsKey, materialize } from '../storage/artifacts.js';
import { setTimeout as delay } from 'node:timers/promises';
import { gunzipSync } from 'node:zlib';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DomainError, type SkyGrid, type WiseReference } from '@spherex/contracts';
import { readLimited } from '../observations/irsa.js';
import { cacheRoot } from '../observations/imaging/paths.js';
import { renderReference } from '../observations/imaging/worker-runner.js';
type WiseProduct = {
  sourceUrl: string;
  timeStart: string | null;
  timeEnd: string | null;
  ra: number;
  dec: number;
};
function mjdTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100000
    ? new Date((number - 40587) * 86400000).toISOString()
    : null;
}
/** SIA2 contains auxiliary/uncertainty products too; only science intensity FITS are comparable. */
export function parseWiseSia(data: unknown, band: 'W1' | 'W2'): WiseProduct[] {
  const root = data as {
    VOTABLE?: {
      RESOURCE_ARRAY?: {
        INFO_ARRAY?: { '<xmlattr>': { name: string; value: string } }[];
        TABLE?: {
          FIELD_ARRAY: { '<xmlattr>': { name: string } }[];
          DATA: { TABLEDATA?: string[][] };
        };
      }[];
    };
  };
  const resources = root?.VOTABLE?.RESOURCE_ARRAY;
  if (!Array.isArray(resources))
    throw new DomainError('DATA_SCHEMA_ERROR', 'Unexpected WISE SIA2 response.');
  if (
    resources.some((resource) =>
      resource.INFO_ARRAY?.some(
        (info) =>
          info['<xmlattr>'].name === 'QUERY_STATUS' &&
          ['ERROR', 'OVERFLOW'].includes(info['<xmlattr>'].value),
      ),
    )
  )
    throw new DomainError(
      'DATA_SOURCE_ERROR',
      'WISE SIA2 query failed or exceeded its result limit.',
    );
  const table = resources.find((resource) => resource.TABLE)?.TABLE;
  if (!table || !Array.isArray(table.FIELD_ARRAY))
    throw new DomainError('DATA_SCHEMA_ERROR', 'Missing WISE SIA2 table.');
  const names = table.FIELD_ARRAY.map((field) => field['<xmlattr>'].name);
  for (const field of [
    'access_url',
    'energy_bandpassname',
    'dataproduct_subtype',
    'obs_collection',
    's_ra',
    's_dec',
  ])
    if (!names.includes(field))
      throw new DomainError('DATA_SCHEMA_ERROR', `Missing WISE field: ${field}`);
  const products: WiseProduct[] = [];
  for (const cells of table.DATA.TABLEDATA ?? []) {
    const row = Object.fromEntries(names.map((name, index) => [name, cells[index] ?? '']));
    if (
      row.energy_bandpassname !== band ||
      row.dataproduct_subtype !== 'science' ||
      row.obs_collection !== 'wise_allwise'
    )
      continue;
    const url = new URL(row.access_url!);
    const path = url.pathname.match(
      /^\/ibe\/data\/wise\/allwise\/p3am_cdd\/\d{2}\/\d{4}\/(\d{4}[pm]\d{3}_ac51)\/\1-w([12])-int-3\.fits$/,
    );
    if (
      url.origin !== 'https://irsa.ipac.caltech.edu' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !path ||
      path[2] !== band.slice(1)
    )
      throw new DomainError('DATA_SCHEMA_ERROR', 'Invalid AllWISE science product URL.');
    const ra = Number(row.s_ra),
      dec = Number(row.s_dec);
    if (!row.s_ra || !row.s_dec || !Number.isFinite(ra) || !Number.isFinite(dec))
      throw new DomainError('DATA_SCHEMA_ERROR', 'Invalid AllWISE position.');
    products.push({
      sourceUrl: url.toString(),
      ra,
      dec,
      timeStart: mjdTime(row.t_min),
      timeEnd: mjdTime(row.t_max),
    });
  }
  return products;
}
async function fetchWiseBytes(url: URL | string, timeout: number, limit: number) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
        redirect: 'error',
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status < 500 && response.status !== 429)
          throw new DomainError(
            'DATA_SOURCE_ERROR',
            `WISE request failed (HTTP ${response.status}).`,
          );
        throw new Error(`WISE HTTP ${response.status}`);
      }
      return await readLimited(response, limit);
    } catch (error) {
      if (attempt >= 1 || error instanceof DomainError) throw error;
      await delay(250);
    }
  }
}
export async function queryWise(grid: SkyGrid, band: 'W1' | 'W2'): Promise<WiseReference> {
  let directory: string | undefined;
  try {
    const query = new URL('https://irsa.ipac.caltech.edu/SIA');
    query.search = new URLSearchParams({
      COLLECTION: 'wise_allwise',
      POS: `CIRCLE ${grid.raDeg} ${grid.decDeg} 0.000001`,
      FORMAT: 'image/fits',
      RESPONSEFORMAT: 'json',
      MAXREC: '256',
    }).toString();
    const products = parseWiseSia(
      JSON.parse((await fetchWiseBytes(query, 15000, 2 * 1024 * 1024)).toString('utf8')),
      band,
    );
    const radians = Math.PI / 180;
    const distance = (product: WiseProduct) =>
      Math.sin(grid.decDeg * radians) * Math.sin(product.dec * radians) +
      Math.cos(grid.decDeg * radians) *
        Math.cos(product.dec * radians) *
        Math.cos((product.ra - grid.raDeg) * radians);
    products.sort((a, b) => distance(b) - distance(a));
    const product = products[0];
    if (!product) throw new DomainError('RESOURCE_NOT_FOUND', 'No AllWISE tile covers this field.');
    const { sourceUrl } = product;
    const fov = Math.min(2, grid.width * grid.pixelScaleDeg * 1.05);
    const cutout = `${sourceUrl}?center=${grid.raDeg},${grid.decDeg}&size=${fov}`;
    const sourcePath = await materialize(fitsKey(cutout), {
      limit: 32 * 1024 * 1024,
      load: async () => {
        const downloaded = await fetchWiseBytes(
          `${sourceUrl}?center=${grid.raDeg},${grid.decDeg}&size=${fov}`,
          30000,
          32 * 1024 * 1024,
        );
        // IBE cutouts may be gzip streams even when the requested product ends in .fits.
        const bytes =
          downloaded[0] === 0x1f && downloaded[1] === 0x8b
            ? gunzipSync(downloaded, { maxOutputLength: 32 * 1024 * 1024 })
            : downloaded;
        if (bytes.subarray(0, 6).toString() !== 'SIMPLE') throw new Error();
        return bytes;
      },
    });
    await mkdir(join(cacheRoot, 'analyses'), { recursive: true });
    directory = await mkdtemp(join(cacheRoot, 'analyses', 'wise-'));
    const path = sourcePath;
    const manifest = join(directory, 'request.json');
    await writeFile(manifest, JSON.stringify({ path, grid }));
    const rendered = await renderReference(manifest);
    return {
      ...rendered,
      timeStart: rendered.timeStart ?? product.timeStart,
      timeEnd: rendered.timeEnd ?? product.timeEnd,
      sourceUrl,
      band,
    };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(
      'DATA_SOURCE_ERROR',
      'WISE is temporarily unavailable. Please retry or open IRSA.',
    );
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
