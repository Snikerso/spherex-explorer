import { DomainError, gaiaResultSchema, type GaiaResult } from '@spherex/contracts';
import { readLimited } from '../observations/irsa.js';
export function parseGaiaCsv(csv: string, radiusDeg: number): GaiaResult {
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
  const expected = [
    'source_id',
    'ra',
    'dec',
    'ref_epoch',
    'pmra',
    'pmdec',
    'parallax',
    'phot_g_mean_mag',
  ];
  if (rows[0]?.join(',') !== expected.join(','))
    throw new DomainError('DATA_SCHEMA_ERROR', 'Unexpected Gaia response.');
  const number = (value: string | undefined) => (!value || value === 'null' ? null : Number(value));
  return gaiaResultSchema.parse({
    catalog: 'Gaia DR3',
    radiusDeg,
    truncated: rows.length > 301,
    sources: rows.slice(1, 301).map((row) => ({
      id: row[0],
      raDeg: number(row[1]),
      decDeg: number(row[2]),
      epoch: number(row[3]),
      pmra: number(row[4]),
      pmdec: number(row[5]),
      parallaxMas: number(row[6]),
      magnitude: number(row[7]),
    })),
  });
}
export async function queryGaia(ra: number, dec: number, radius: number, signal?: AbortSignal) {
  const url = new URL('https://gea.esac.esa.int/tap-server/tap/sync');
  url.search = new URLSearchParams({
    REQUEST: 'doQuery',
    LANG: 'ADQL',
    FORMAT: 'csv',
    QUERY: `SELECT TOP 301 source_id,ra,dec,ref_epoch,pmra,pmdec,parallax,phot_g_mean_mag FROM gaiadr3.gaia_source WHERE 1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${ra},${dec},${radius})) ORDER BY phot_g_mean_mag ASC`,
  }).toString();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.any([AbortSignal.timeout(25000), ...(signal ? [signal] : [])]),
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error();
    }
    return parseGaiaCsv((await readLimited(response, 1024 * 1024)).toString('utf8'), radius);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('DATA_SOURCE_ERROR', 'Gaia is temporarily unavailable. Please retry.');
  }
}
