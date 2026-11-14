import { readdir, lstat, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

async function entries(path: string) {
  try {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) return [];
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** Only managed directories are visited; symbolic links are never followed. */
export async function cleanCache(
  root: string,
  sequenceIds: Set<string>,
  before: Date,
  referenceIds = sequenceIds,
) {
  let removed = 0;
  const fits = new Set<string>();
  let completeReferences = true;
  for (const entry of await entries(join(root, 'sequences'))) {
    if (entry.isSymbolicLink()) continue;
    const path = join(root, 'sequences', entry.name);
    if (sequenceIds.has(entry.name)) {
      if (!referenceIds.has(entry.name)) continue;
      try {
        const manifest = JSON.parse(await readFile(join(path, 'request.json'), 'utf8'));
        if (!Array.isArray(manifest.files)) throw new Error('Invalid manifest');
        for (const file of manifest.files) {
          if (typeof file.path !== 'string') throw new Error('Invalid FITS reference');
          fits.add(file.path);
        }
      } catch {
        completeReferences = false;
      }
    } else if ((await lstat(path)).mtime < before) {
      await rm(path, { recursive: true, force: true });
      removed++;
    }
  }
  // A missing manifest for a retained sequence must not make its shared FITS disposable.
  for (const id of referenceIds) {
    try {
      await lstat(join(root, 'sequences', id, 'request.json'));
    } catch {
      completeReferences = false;
    }
  }
  for (const category of ['fits', 'analyses', 'exports']) {
    if (category === 'fits' && !completeReferences) continue;
    for (const entry of await entries(join(root, category))) {
      if (entry.isSymbolicLink() || fits.has(`${category}/${entry.name}`)) continue;
      const path = join(root, category, entry.name);
      if ((await lstat(path)).mtime >= before) continue;
      await rm(path, { recursive: true, force: true });
      removed++;
    }
  }
  return removed;
}
