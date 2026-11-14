import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DomainError, type SkyGrid, type WiseReference } from '@spherex/contracts';
import { readLimited } from '../observations/irsa.js';
import { renderReference } from '../observations/imaging/worker-runner.js';
export function parseIpacTable(text: string) {
  const lines = text.split(/\r?\n/);
  const header = lines.find(line => line.startsWith('|'));
  if (!header) throw new DomainError('DATA_SCHEMA_ERROR', 'Unexpected WISE response.');
  const edges = [...header.matchAll(/\|/g)].map(match => match.index!);
  const names = edges.slice(0,-1).map((start,i) => header.slice(start+1,edges[i+1]).trim());
  return lines.filter(line => line.trim() && !/^[\\|]/.test(line)).map(line => Object.fromEntries(names.map((name,i) => [name, line.slice(edges[i]!+1,edges[i+1]).trim()])));
}
export async function queryWise(grid: SkyGrid, band: 'W1' | 'W2'): Promise<WiseReference> {
  let directory: string | undefined;
  try {
    const query = new URL('https://irsa.ipac.caltech.edu/ibe/search/wise/allwise/p3am_cdd');
    query.search = new URLSearchParams({ POS:`${grid.raDeg},${grid.decDeg}`, INTERSECT:'CENTER' }).toString();
    const response = await fetch(query, { signal: AbortSignal.timeout(30000), redirect:'error' });
    if (!response.ok) { await response.body?.cancel(); throw new Error(); }
    const rows = parseIpacTable((await readLimited(response, 2*1024*1024)).toString('utf8'));
    const row = rows.find(row => row.band === band.slice(1) && /^\d{4}[pm]\d{3}_ac51$/.test(row.coadd_id ?? ''));
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND', 'No AllWISE tile covers this field.');
    const id = row.coadd_id!;
    const sourceUrl = `https://irsa.ipac.caltech.edu/ibe/data/wise/allwise/p3am_cdd/${id.slice(0,2)}/${id.slice(0,4)}/${id}/${id}-w${band.slice(1)}-int-3.fits`;
    const fov = Math.min(2, grid.width * grid.pixelScaleDeg * 1.05);
    const image = await fetch(`${sourceUrl}?center=${grid.raDeg},${grid.decDeg}&size=${fov}`, { signal:AbortSignal.timeout(60000), redirect:'error' });
    if (!image.ok) { await image.body?.cancel(); throw new Error(); }
    const bytes = await readLimited(image, 32*1024*1024);
    if (bytes.subarray(0,6).toString() !== 'SIMPLE') throw new Error();
    directory = await mkdtemp(join(tmpdir(),'spherex-wise-'));
    const path = join(directory,'source.fits'); await writeFile(path,bytes);
    const manifest = join(directory,'request.json'); await writeFile(manifest,JSON.stringify({ path, grid }));
    const rendered = await renderReference(manifest);
    return { ...rendered, sourceUrl, band };
  } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('DATA_SOURCE_ERROR', 'WISE is temporarily unavailable. Please retry or open IRSA.'); }
  finally { if (directory) await rm(directory,{ recursive:true, force:true }); }
}
