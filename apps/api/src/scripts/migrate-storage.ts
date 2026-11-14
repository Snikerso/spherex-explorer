import { connect, disconnect } from 'mongoose';
import { readdir, readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { settings } from '../config.js';
import { cacheRoot } from '../modules/observations/imaging/paths.js';
import { persistSequence, materialize } from '../modules/storage/artifacts.js';
import { objectStore } from '../modules/storage/objects.js';

async function main() {
  const store = objectStore();
  if (!store) throw new Error('Configure Spaces before migrating.');
  const connection = await connect(settings.MONGODB_URI);
  let sequences = 0,
    fits = 0;
  try {
    const records = connection.connection.db!.collection('sequences').find({ status: 'ready' });
    const keys = new Set<string>();
    for await (const record of records) {
      const request = resolve(cacheRoot, 'sequences', record.id, 'request.json');
      try {
        await access(request);
      } catch {
        continue;
      }
      const manifest = JSON.parse(await readFile(request, 'utf8'));
      for (const file of manifest.files ?? []) keys.add(file.path);
      for (const file of keys) {
        await materialize(file);
      }
      await persistSequence(record.id);
      sequences++;
    }
    const entries = await readdir(resolve(cacheRoot, 'fits')).catch(() => [] as string[]);
    // All local canonical FITS can serve later sessions, even after their original session expires.
    const candidates = entries.filter((name) => /^[a-f0-9]{64}\.fits$/.test(name));
    for (let i = 0; i < candidates.length; i += 4)
      await Promise.all(
        candidates.slice(i, i + 4).map(async (name) => {
          const bytes = await readFile(resolve(cacheRoot, 'fits', name));
          if (bytes.subarray(0, 9).toString() !== 'SIMPLE  =') return;
          await store.put(`fits/${name}`, bytes);
          fits++;
        }),
      );
    console.log(JSON.stringify({ migratedSequences: sequences, migratedFits: fits }));
  } finally {
    await disconnect();
  }
}
main().catch(() => {
  console.error(
    'Storage migration failed; inspect configuration and retry. Existing uploads can be reused.',
  );
  process.exitCode = 1;
});
