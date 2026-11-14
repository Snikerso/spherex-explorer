import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { releaseCatalog } from '../src/modules/observations/releases.js';
import { IrsaClient, safeSourceUrl } from '../src/modules/observations/irsa.js';
const directories: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
describe('reloadable release catalog', () => {
  it('loads a new release without changing schemas or the IRSA adapter', async () => {
    const catalog = releaseCatalog(); const dir = mkdtempSync(join(tmpdir(), 'spherex-releases-')); directories.push(dir); const path = join(dir, 'releases.json');
    writeFileSync(path, JSON.stringify(catalog)); vi.stubEnv('SPHEREX_RELEASES_FILE', path);
    expect(releaseCatalog().releases).toHaveLength(catalog.releases.length);
    const updated = { ...catalog, releases: [...catalog.releases, { id: 'future', label: 'Future test release', collection: 'spherex_future', productPath: '/ibe/data/spherex/future/level2/', enabled: true }] };
    writeFileSync(path, JSON.stringify(updated)); utimesSync(path, new Date(), new Date(Date.now() + 2000));
    expect(releaseCatalog().releases).toHaveLength(catalog.releases.length + 1);
    expect(safeSourceUrl('https://irsa.ipac.caltech.edu/ibe/data/spherex/future/level2/a.fits').hostname).toBe('irsa.ipac.caltech.edu');
    const fields = ['access_url', 't_min', 'obs_id', 'energy_bandpassname', 'em_min', 'em_max'].map(name => ({ '<xmlattr>': { name } }));
    const data = { VOTABLE: { RESOURCE_ARRAY: [{ TABLE: { FIELD_ARRAY: fields, DATA: { TABLEDATA: [] } } }] } };
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(data)));

    await new IrsaClient(request).search({ raDeg: 1, decDeg: 2, fovDeg: .1, fromUtc: null, toUtc: null, release: 'future' });
    expect(new URL(request.mock.calls[0]![0] as unknown as string).searchParams.get('COLLECTION')).toBe('spherex_future');
    expect(() => safeSourceUrl('https://example.com/ibe/data/spherex/future/level2/a.fits')).toThrow();
    const invalid = JSON.parse(readFileSync(path, 'utf8')); invalid.defaultRelease = 'missing'; writeFileSync(path, JSON.stringify(invalid)); utimesSync(path, new Date(), new Date(Date.now() + 4000));
    expect(() => releaseCatalog()).toThrow();
  });
});
