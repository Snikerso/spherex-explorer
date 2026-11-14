import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { DomainError } from '@spherex/contracts';
const schema = z
  .object({
    defaultRelease: z.string(),
    releases: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
            label: z.string().min(1).max(80),
            collection: z.string().regex(/^spherex_[a-z0-9_-]+$/),
            productPath: z.string().regex(/^\/ibe\/data\/spherex\/[a-z0-9_-]+\/level2\/$/),
            enabled: z.boolean(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .refine(
    (catalog) =>
      new Set(catalog.releases.map((item) => item.id)).size === catalog.releases.length &&
      catalog.releases.some((item) => item.id === catalog.defaultRelease && item.enabled),
  );
let cached: { path: string; mtime: number; value: z.infer<typeof schema> } | undefined;
export function releaseCatalog(
  path = process.env.SPHEREX_RELEASES_FILE ??
    resolve(
      fileURLToPath(new URL('../../../../../', import.meta.url)),
      'config/spherex-releases.json',
    ),
) {
  try {
    const mtime = statSync(path).mtimeMs;
    if (cached?.path === path && cached.mtime === mtime) return cached.value;
    const value = schema.parse(JSON.parse(readFileSync(path, 'utf8')));
    cached = { path, mtime, value };
    return value;
  } catch {
    throw new DomainError(
      'DATA_SCHEMA_ERROR',
      'Nieprawidłowy katalog wydań SPHEREx. Sprawdź plik konfiguracji.',
    );
  }
}
export function activeRelease(id: string) {
  const release = releaseCatalog().releases.find((item) => item.id === id && item.enabled);
  if (!release)
    throw new DomainError(
      'INVALID_SELECTION',
      'To wydanie danych nie jest aktywne. Odśwież listę wydań.',
    );
  return release;
}
