import { setTimeout as delay } from 'node:timers/promises';
import { activeRelease, releaseCatalog } from './releases.js';
import { createHash } from 'node:crypto';
import {
  DomainError,
  searchInputSchema,
  type Observation,
  type SearchInput,
} from '@spherex/contracts';

export function safeSourceUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'irsa.ipac.caltech.edu' ||
    url.port ||
    url.username ||
    url.password ||
    !releaseCatalog().releases.some(
      (release) =>
        url.pathname.startsWith(release.productPath) &&
        /^[\w/.-]+\.fits$/.test(url.pathname.slice(release.productPath.length)),
    ) ||
    url.search ||
    url.hash
  ) {
    throw new DomainError('INVALID_SOURCE_URL', 'Nieprawidłowy adres produktu archiwum IRSA.');
  }
  return url;
}

/** IRSA's cutout handler requires a literal comma in center (encoded %2C returns HTTP 503). */
export function cutoutUrl(source: string, input: SearchInput) {
  const validated = searchInputSchema.parse(input);
  return new URL(
    `${safeSourceUrl(source)}?center=${validated.raDeg},${validated.decDeg}&size=${validated.fovDeg}`,
  );
}

export async function readLimited(response: Response, limit: number) {
  if (!response.body)
    throw new DomainError('DATA_SOURCE_ERROR', 'Archiwum zwróciło pustą odpowiedź.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > limit)
        throw new DomainError(
          'DATA_LIMIT',
          'Odpowiedź archiwum przekroczyła limit rozmiaru. Zmniejsz pole.',
        );
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}

type RawResource = {
  INFO_ARRAY?: { '<xmlattr>': { name: string; value: string } }[];
  TABLE?: { FIELD_ARRAY: { '<xmlattr>': { name: string } }[]; DATA: { TABLEDATA?: string[][] } };
};
export function parseSia(data: unknown, release: SearchInput['release']) {
  const resources = (data as { VOTABLE?: { RESOURCE_ARRAY?: RawResource[] } }).VOTABLE
    ?.RESOURCE_ARRAY;
  if (!Array.isArray(resources))
    throw new DomainError('DATA_SCHEMA_ERROR', 'Nierozpoznany format odpowiedzi IRSA.');
  const resource = resources.find((entry) => entry.TABLE);
  if (!resource?.TABLE)
    throw new DomainError('DATA_SCHEMA_ERROR', 'Brak tabeli obserwacji w odpowiedzi archiwum.');
  const statuses = resources
    .flatMap((resource) => resource.INFO_ARRAY ?? [])
    .filter((info) => info['<xmlattr>'].name === 'QUERY_STATUS');
  if (statuses.some((info) => info['<xmlattr>'].value === 'ERROR'))
    throw new DomainError('DATA_SOURCE_ERROR', 'Archiwum odrzuciło zapytanie.');
  if (statuses.some((info) => info['<xmlattr>'].value === 'OVERFLOW'))
    throw new DomainError('DATA_LIMIT', 'IRSA ograniczyło wyniki. Zmniejsz pole lub zakres dat.');
  const names = resource.TABLE.FIELD_ARRAY.map((field) => field['<xmlattr>'].name);
  for (const required of [
    'access_url',
    't_min',
    'obs_id',
    'energy_bandpassname',
    'em_min',
    'em_max',
  ]) {
    if (!names.includes(required))
      throw new DomainError('DATA_SCHEMA_ERROR', `Brak wymaganego pola IRSA: ${required}.`);
  }
  const observations: Observation[] = [];
  for (const cells of resource.TABLE.DATA.TABLEDATA ?? []) {
    const row = Object.fromEntries(names.map((name, index) => [name, cells[index] ?? '']));
    if (row.dataproduct_type !== 'image') continue;
    const sourceUrl = safeSourceUrl(row.access_url!).toString();
    if (!new URL(sourceUrl).pathname.startsWith(activeRelease(release).productPath))
      throw new DomainError(
        'DATA_SCHEMA_ERROR',
        'Produkt pochodzi z innego wydania niż wybrane wyszukiwanie.',
      );
    const mjd = Number(row.t_min);
    const detector = row.energy_bandpassname!;
    if (!Number.isFinite(mjd) || !/^SPHEREx-D[1-6]$/.test(detector))
      throw new DomainError(
        'DATA_SCHEMA_ERROR',
        'Nieprawidłowy czas lub detektor w metadanych IRSA.',
      );
    const calibrationVersion = sourceUrl.match(/l2b-v([\w-]+)\//)?.[1] ?? 'unknown';
    observations.push({
      id: createHash('sha256').update(sourceUrl).digest('hex').slice(0, 32),
      sourceId: row.obs_id!,
      sourceUrl,
      observedAtUtc: new Date((mjd - 40587) * 86400000).toISOString(),
      originalMjd: mjd,
      detector,
      release,
      calibrationVersion,
      comparisonGroup: `${release}:${detector}`, // Only a candidate group; the worker MUST check WCS-WAVE.
      spectralRangeUm: [Number(row.em_min) * 1e6, Number(row.em_max) * 1e6],
      exposureSeconds: Number(row.t_exptime),
      qualityFlags: [
        'Dokładna zgodność długości fali i maski zostaną sprawdzone podczas przygotowania.',
      ],
    });
  }
  return [...new Map(observations.map((item) => [item.id, item])).values()].sort((a, b) =>
    a.observedAtUtc.localeCompare(b.observedAtUtc),
  );
}

export class IrsaClient {
  constructor(private readonly request: typeof fetch = fetch) {}
  async search(input: SearchInput, signal?: AbortSignal) {
    searchInputSchema.parse(input);
    const url = new URL('https://irsa.ipac.caltech.edu/SIA');
    url.searchParams.set('COLLECTION', activeRelease(input.release).collection);
    url.searchParams.set(
      'POS',
      `CIRCLE ${input.raDeg} ${input.decDeg} ${input.fovDeg / Math.sqrt(2)}`,
    );
    url.searchParams.set('RESPONSEFORMAT', 'JSON');
    if (input.fromUtc || input.toUtc) {
      const mjd = (value: string) => Date.parse(value) / 86400000 + 40587;
      url.searchParams.set(
        'TIME',
        `${input.fromUtc ? mjd(input.fromUtc) : '-Inf'} ${input.toUtc ? mjd(input.toUtc) : '+Inf'}`,
      );
    }
    try {
      const combined = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(25000)])
        : AbortSignal.timeout(25000);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await this.request(url, { signal: combined, redirect: 'error' });
          if (!response.ok) {
            await response.body?.cancel();
            if (
              (response.status >= 500 || response.status === 429) &&
              attempt < 2 &&
              !combined.aborted
            ) {
              await delay(300 * (attempt + 1), undefined, { signal: combined });
              continue;
            }
            throw new DomainError(
              'DATA_SOURCE_ERROR',
              `Archiwum IRSA jest chwilowo niedostępne (HTTP ${response.status}).`,
            );
          }
          const text = (await readLimited(response, 8 * 1024 * 1024)).toString('utf8');
          let data: unknown;
          try {
            data = JSON.parse(text);
          } catch {
            throw new DomainError(
              'DATA_SCHEMA_ERROR',
              'IRSA nie zwróciło poprawnych metadanych. Spróbuj ponownie.',
            );
          }
          return parseSia(data, input.release);
        } catch (error) {
          if (error instanceof DomainError || combined.aborted || attempt === 2) throw error;
          await delay(300 * (attempt + 1), undefined, { signal: combined });
        }
      }
      throw new Error('IRSA attempts exhausted');
    } catch (error) {
      if (error instanceof DomainError || signal?.aborted) throw error;
      throw new DomainError(
        'DATA_SOURCE_TIMEOUT',
        'Nie udało się pobrać obserwacji z IRSA. Spróbuj ponownie.',
      );
    }
  }
}
