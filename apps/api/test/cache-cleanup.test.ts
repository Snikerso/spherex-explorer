import { mkdtemp, mkdir, writeFile, utimes, access, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { cleanCache } from '../src/modules/maintenance/cache-cleanup.js';
import { maintainCache, useCache } from '../src/modules/maintenance/cache-usage.js';
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'spherex-cleanup-'));
  roots.push(root);
  const old = new Date('2020-01-01');
  async function file(path: string, data = '', aged = true) {
    const full = join(root, path);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, data);
    if (aged) await utimes(full, old, old);
    return full;
  }
  return { root, old, file };
}
it('removes only old unused cache and preserves shared FITS, live sequences and recent files', async () => {
  const { root, old, file } = await fixture();
  await file(
    'sequences/live/request.json',
    JSON.stringify({ files: [{ path: 'fits/shared.fits' }] }),
  );
  await file('fits/shared.fits');
  await file('fits/orphan.fits');
  await file('fits/new.tmp', '', false);
  await file('sequences/orphan/image.png');
  await utimes(join(root, 'sequences/orphan'), old, old);
  await file('exports/stale/video.mp4');
  await utimes(join(root, 'exports/stale'), old, old);
  await file('analyses/new/request.json', '', false);
  const outside = await file('outside/keep');
  await symlink(join(root, 'outside'), join(root, 'exports/link'));
  expect(await cleanCache(root, new Set(['live']), new Date('2021-01-01'))).toBe(3);
  for (const name of [
    'sequences/live/request.json',
    'fits/shared.fits',
    'fits/new.tmp',
    'analyses/new/request.json',
  ])
    await expect(access(join(root, name))).resolves.toBeUndefined();
  await expect(access(outside)).resolves.toBeUndefined();
  for (const name of ['fits/orphan.fits', 'sequences/orphan', 'exports/stale'])
    await expect(access(join(root, name))).rejects.toThrow();
});
it('keeps shared FITS when a retained manifest is missing or malformed', async () => {
  const { root, file } = await fixture();
  await file('fits/possibly-needed.fits');
  await cleanCache(root, new Set(['missing']), new Date());
  await expect(access(join(root, 'fits/possibly-needed.fits'))).resolves.toBeUndefined();
  await file('sequences/missing/request.json', '{');
  await cleanCache(root, new Set(['missing']), new Date());
  await expect(access(join(root, 'fits/possibly-needed.fits'))).resolves.toBeUndefined();
});
it('does not overlap maintenance and cache workers in either direction', async () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const worker = useCache(() => wait);
  expect(await maintainCache(async () => 'unsafe')).toBeUndefined();
  release();
  await worker;
  let finish!: () => void;
  const hold = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const cleanup = maintainCache(() => hold);
  let entered = false;
  const next = useCache(async () => {
    entered = true;
  });
  await Promise.resolve();
  expect(entered).toBe(false);
  finish();
  await cleanup;
  await next;
  expect(entered).toBe(true);
});

it('does not traverse a symlink used as a managed cache directory', async () => {
  const { root, file } = await fixture();
  const outside = await file('outside/keep.fits');
  await symlink(join(root, 'outside'), join(root, 'fits'));
  expect(await cleanCache(root, new Set(), new Date())).toBe(0);
  await expect(access(outside)).resolves.toBeUndefined();
});
