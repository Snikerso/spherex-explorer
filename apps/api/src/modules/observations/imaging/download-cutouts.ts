import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, rename, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DomainError, type Observation, type SearchInput } from '@spherex/contracts';
import { mapConcurrent } from '../concurrent.js';
import { readLimited, cutoutUrl } from '../irsa.js';
import { cacheRoot } from './paths.js';
export async function downloadCutouts(
  observations: Observation[],
  input: SearchInput,
  signal: AbortSignal,
  onProgress: (progress: number) => Promise<unknown>,
) {
  const downloadWarnings: string[] = [];
  let completed = 0;
  const downloaded = await mapConcurrent(observations, 4, signal, async (observation) => {
    signal.throwIfAborted();
    try {
      const url = cutoutUrl(observation.sourceUrl!, input);
      const key = createHash('sha256').update(url.toString()).digest('hex');
      const path = `fits/${key}.fits`;
      const destination = resolve(cacheRoot, path);
      await mkdir(resolve(cacheRoot, 'fits'), { recursive: true });
      try {
        await access(destination);
      } catch {
        let bytes: Buffer | undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(url, {
              redirect: 'error',
              signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
            });
            if (!response.ok) {
              await response.body?.cancel();
              throw new DomainError(
                'DATA_SOURCE_ERROR',
                `Nie udało się pobrać wycinka IRSA (HTTP ${response.status}).`,
              );
            }
            bytes = await readLimited(response, (input.fovDeg > 0.5 ? 128 : 32) * 1024 * 1024);
            break;
          } catch (error) {
            if (signal.aborted || attempt === 2) throw error;
            await delay(1000 * (attempt + 1), undefined, { signal });
          }
        }
        if (!bytes) throw new DomainError('DATA_SOURCE_ERROR', 'Brak wycinka FITS.');
        if (bytes.subarray(0, 6).toString() !== 'SIMPLE')
          throw new DomainError('INVALID_FITS', 'IRSA nie zwróciło pliku FITS.');
        const temporary = `${destination}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, bytes);
          signal.throwIfAborted();
          await rename(temporary, destination);
        } finally {
          await rm(temporary, { force: true });
        }
      }
      return {
        id: randomUUID(),
        observationId: observation.id,
        observedAtUtc: observation.observedAtUtc,
        sourceUrl: observation.sourceUrl,
        path,
        detector: observation.detector,
      };
    } catch (error) {
      signal.throwIfAborted();
      downloadWarnings.push(
        `Pominięto produkt ${observation.sourceId ?? observation.id}: ${error instanceof DomainError ? error.message : 'Nie udało się pobrać FITS po trzech próbach.'}`,
      );
    } finally {
      completed++;
      await onProgress(Math.round((completed / observations.length) * 70));
    }
  });
  const files = downloaded.filter((file): file is NonNullable<typeof file> => Boolean(file));
  return { files, downloadWarnings };
}
