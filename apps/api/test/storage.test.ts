import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { materialize, fitsKey } from '../src/modules/storage/artifacts.js';
import type { ObjectStore } from '../src/modules/storage/objects.js';
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'spherex-storage-'));
  roots.push(root);
  const data = new Map<string, Buffer>();
  const store: ObjectStore = {
    get: vi.fn(async (key) => data.get(key) ?? null),
    put: vi.fn(async (key, bytes) => {
      data.set(key, bytes);
    }),
    async *list() {},
    remove: vi.fn(async (key) => {
      data.delete(key);
    }),
  };
  return { root, store, data };
}
it('deduplicates concurrent downloads and restores from Spaces after local eviction', async () => {
  const { root, store } = await setup();
  const key = fitsKey('https://irsa.ipac.caltech.edu/example?center=1,2&size=.1');
  const load = vi.fn(async () => Buffer.from('SIMPLE  = reusable FITS'));
  const paths = await Promise.all(
    Array.from({ length: 8 }, () => materialize(key, { root, store, load })),
  );
  expect(new Set(paths).size).toBe(1);
  expect(load).toHaveBeenCalledOnce();
  expect(store.put).toHaveBeenCalledOnce();
  await rm(paths[0]!);
  await materialize(key, { root, store, load });
  expect(load).toHaveBeenCalledOnce();
  expect((await readFile(paths[0]!)).toString()).toContain('reusable FITS');
});
it('backfills existing local FITS once, without fetching IRSA or repeatedly uploading', async () => {
  const { root, store } = await setup();
  const key = fitsKey('existing');
  await mkdir(join(root, 'fits'));
  await writeFile(join(root, key), 'local FITS');
  const load = vi.fn();
  await materialize(key, { root, store, load });
  await materialize(key, { root, store, load });
  expect(load).not.toHaveBeenCalled();
  expect(store.put).toHaveBeenCalledOnce();
  expect(store.get).not.toHaveBeenCalled();
});
it('propagates storage outages and never treats them as cache misses', async () => {
  const { root, store } = await setup();
  vi.mocked(store.get).mockRejectedValue(new Error('Spaces offline'));
  const load = vi.fn();
  await expect(materialize(fitsKey('offline'), { root, store, load })).rejects.toThrow('offline');
  expect(load).not.toHaveBeenCalled();
});
it('separates crop identities and rejects traversal keys', async () => {
  expect(fitsKey('url?size=.1')).not.toBe(fitsKey('url?size=.2'));
  const { root, store } = await setup();
  await expect(materialize('sequences/../../secret', { root, store })).rejects.toThrow('Invalid');
});

it('cleans orphan output and aged unreferenced FITS while retaining active references', async () => {
  const { cleanRemoteStorage } = await import('../src/modules/storage/cleanup.js');
  const { root, store, data } = await setup();
  const id = '00000000-0000-4000-8000-000000000001';
  const keep = fitsKey('keep'),
    stale = fitsKey('stale'),
    recent = fitsKey('recent');
  data.set(
    `sequences/${id}/request.json`,
    Buffer.from(JSON.stringify({ files: [{ path: keep }] })),
  );
  data.set(keep, Buffer.from('keep'));
  data.set(stale, Buffer.from('stale'));
  data.set(recent, Buffer.from('recent'));
  data.set('sequences/expired/frame.png', Buffer.from('orphan'));
  store.list = async function* (prefix) {
    for (const key of data.keys())
      if (key.startsWith(prefix))
        yield { key, modified: key === recent ? new Date() : new Date('2020-01-01') };
  };
  await cleanRemoteStorage([{ id, status: 'ready' }], new Date(Date.now() - 86400000), store, root);
  expect(data.has(keep)).toBe(true);
  expect(data.has(recent)).toBe(true);
  expect(data.has(stale)).toBe(false);
  expect(data.has('sequences/expired/frame.png')).toBe(false);
});
