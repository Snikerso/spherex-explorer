import { DomainError } from '@spherex/contracts';
import { readLimited } from '../observations/irsa.js';
export type NeossatInput = { ra: number; dec: number; radius: number; from?: string; to?: string };
export async function queryNeossat(input: NeossatInput) {
  const mjd = (utc: string) => Date.parse(utc) / 86400000 + 40587;
  const query = `SELECT TOP 101 obs_id,obs_collection,t_min,t_max,obs_publisher_did FROM ivoa.ObsCore WHERE obs_collection='NEOSSAT' AND INTERSECTS(s_region,CIRCLE('ICRS',${input.ra},${input.dec},${input.radius}))=1${input.from ? ` AND t_max>=${mjd(input.from)}` : ''}${input.to ? ` AND t_min<=${mjd(input.to)}` : ''} ORDER BY t_min DESC`;
  const url = new URL('https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/argus/sync');
  url.search = new URLSearchParams({
    REQUEST: 'doQuery',
    LANG: 'ADQL',
    FORMAT: 'tsv',
    QUERY: query,
  }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error();
    }
    return parseNeossat((await readLimited(response, 1024 * 1024)).toString('utf8'));
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('DATA_SOURCE_ERROR', 'CADC is temporarily unavailable. Please retry.');
  }
}
export function parseNeossat(text: string) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((value) => value.replace(/^"|"$/g, '')));
  const headers = ['obs_id', 'obs_collection', 't_min', 't_max', 'obs_publisher_did'];
  if (rows[0]?.join() !== headers.join())
    throw new DomainError('DATA_SCHEMA_ERROR', 'Unexpected CADC response.');
  const time = (value: string | undefined) => {
    const n = Number(value);
    return value && Number.isFinite(n) && n >= 0 && n <= 100000
      ? new Date((n - 40587) * 86400000).toISOString()
      : null;
  };
  return {
    truncated: rows.length > 101,
    observations: rows.slice(1, 101).map((row) => {
      const id = row[4] ?? '';
      if (row[1] !== 'NEOSSAT' || !id.startsWith('caom:NEOSSAT/'))
        throw new DomainError('DATA_SCHEMA_ERROR', 'Unexpected CADC product.');
      return {
        id: row[0],
        from: time(row[2]),
        to: time(row[3]),
        dataLink: `https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/caom2ops/datalink?ID=${encodeURIComponent(id)}`,
      };
    }),
  };
}
