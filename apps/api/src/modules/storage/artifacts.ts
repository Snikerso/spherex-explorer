import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { cacheRoot } from '../observations/imaging/paths.js';
import { objectStore, type ObjectStore } from './objects.js';

const confirmed = new Set<string>();
const pending = new Map<string, Promise<string>>();
function pathFor(key: string, root = cacheRoot) {
  if (
    !/^(fits\/[a-f0-9]{64}\.fits|sequences\/[a-f0-9-]{36}\/[a-zA-Z0-9_.-]+)$/.test(key) ||
    key.split('/').some((part) => part === '..')
  )
    throw new Error('Invalid artifact key.');
  return resolve(root, key);
}
async function atomic(path: string, bytes: Buffer) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
export function fitsKey(url: URL | string) {
  return `fits/${createHash('sha256').update(String(url)).digest('hex')}.fits`;
}
export async function materialize(
  key: string,
  options: {
    load?: () => Promise<Buffer>;
    signal?: AbortSignal;
    limit?: number;
    store?: ObjectStore;
    root?: string;
  } = {},
) {
  const destination = pathFor(key, options.root);
  const pendingKey = destination;
  let work = pending.get(pendingKey);
  if (!work) {
    work = (async () => {
      const store = options.store ?? objectStore();
      try {
        await access(destination);
        if (store && !confirmed.has(destination)) {
          await store.put(key, await readFile(destination), options.signal);
          confirmed.add(destination);
          if (confirmed.size > 4096) confirmed.delete(confirmed.values().next().value!);
        }
        return destination;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const cached = await store?.get(key, options.limit ?? 128 * 1024 * 1024, options.signal);
      const bytes = cached ?? (await options.load?.());
      if (!bytes) throw new Error(`Artifact unavailable: ${key}`);
      options.signal?.throwIfAborted();
      if (store && !cached) await store.put(key, bytes, options.signal);
      await atomic(destination, bytes);
      if (store) confirmed.add(destination);
      return destination;
    })().finally(() => pending.delete(pendingKey));
    pending.set(pendingKey, work);
  }
  return work;
}
export async function persistSequence(id: string) {
  const store = objectStore();
  if (!store) return;
  const directory = resolve(cacheRoot, 'sequences', id);
  const entries = (await readdir(directory, { withFileTypes: true })).filter(
    (entry) => entry.isFile() && /\.(png|f32|json)$/.test(entry.name),
  );
  for (let i = 0; i < entries.length; i += 4)
    await Promise.all(
      entries.slice(i, i + 4).map(async (entry) => {
        const key = `sequences/${id}/${entry.name}`;
        await store.put(key, await readFile(pathFor(key)));
      }),
    );
}
export async function sequenceInputs(id: string, observationIds?: string[]) {
  const path = await materialize(`sequences/${id}/request.json`, { limit: 4 * 1024 * 1024 });
  const manifest = JSON.parse(await readFile(path, 'utf8')) as {
    files: { path: string; observationId: string }[];
  };
  // Analyses require original radiance, never a regenerated PNG.
  for (const file of manifest.files)
    if (!observationIds || observationIds.includes(file.observationId))
      await materialize(file.path);
  return path;
}
