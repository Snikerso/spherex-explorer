import { randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';
import { DomainError, type Observation, type SearchInput } from '@spherex/contracts';
import { mapConcurrent } from '../concurrent.js';
import { readLimited, cutoutUrl } from '../irsa.js';
import { fitsKey, materialize } from '../../storage/artifacts.js';
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
      const url = cutoutUrl(observation.sourceUrl!, input),
        path = fitsKey(url);
      const limit = (input.fovDeg > 0.5 ? 128 : 32) * 1024 * 1024;
      await materialize(path, {
        signal,
        limit,
        load: async () => {
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
              bytes = await readLimited(response, limit);
              break;
            } catch (error) {
              if (signal.aborted || attempt === 2) throw error;
              await delay(1000 * (attempt + 1), undefined, { signal });
            }
          }
          if (!bytes) throw new DomainError('DATA_SOURCE_ERROR', 'Brak wycinka FITS.');
          if (bytes[0] === 0x1f && bytes[1] === 0x8b)
            bytes = gunzipSync(bytes, { maxOutputLength: limit });
          if (bytes.subarray(0, 6).toString() !== 'SIMPLE')
            throw new DomainError('INVALID_FITS', 'IRSA nie zwróciło pliku FITS.');
          return bytes;
        },
      });
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
        `Pominięto produkt ${observation.sourceId ?? observation.id}: ${error instanceof DomainError ? error.message : 'Nie udało się pobrać lub zapisać FITS.'}`,
      );
    } finally {
      completed++;
      await onProgress(Math.round((completed / observations.length) * 70));
    }
  });
  return {
    files: downloaded.filter((file): file is NonNullable<typeof file> => Boolean(file)),
    downloadWarnings,
  };
}
