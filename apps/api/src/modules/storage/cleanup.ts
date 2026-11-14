import { readFile } from 'node:fs/promises';
import { objectStore, type ObjectStore } from './objects.js';
import { materialize } from './artifacts.js';
import { settings } from '../../config.js';
/** Preserve reusable FITS longer than session outputs; never change whole-bucket lifecycle rules. */
export async function cleanRemoteStorage(
  sequences: { id: string; status?: string }[],
  before: Date,
  store: ObjectStore | undefined = objectStore(),
  root?: string,
) {
  if (!store) return 0;
  const ids = new Set(sequences.map((sequence) => sequence.id));
  const references = new Set<string>();
  let complete = true;
  for (const sequence of sequences.filter((sequence) => sequence.status === 'ready')) {
    try {
      const path = await materialize(`sequences/${sequence.id}/request.json`, {
        limit: 4 * 1024 * 1024,
        store,
        root,
      });
      const manifest = JSON.parse(await readFile(path, 'utf8'));
      if (!Array.isArray(manifest.files)) throw new Error('Missing FITS references');
      for (const file of manifest.files) {
        if (typeof file.path !== 'string') throw new Error('Invalid reference');
        references.add(file.path);
      }
    } catch {
      complete = false;
    }
  }
  let removed = 0;
  for await (const object of store.list('sequences/')) {
    const id = object.key.split('/')[1];
    if (id && !ids.has(id) && object.modified < before) {
      await store.remove(object.key);
      removed++;
    }
  }
  if (complete) {
    const cutoff = new Date(Date.now() - settings.SPACES_FITS_RETENTION_DAYS * 86400000);
    for await (const object of store.list('fits/')) {
      if (!references.has(object.key) && object.modified < cutoff) {
        await store.remove(object.key);
        removed++;
      }
    }
  }
  return removed;
}
