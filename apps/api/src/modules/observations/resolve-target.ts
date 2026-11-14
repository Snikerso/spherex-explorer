import { DomainError, type Target } from '@spherex/contracts';
import { readLimited } from './irsa.js';
import { TARGETS } from './targets.js';

/** Resolve names outside the examples using CDS, never model-guessed coordinates. */
export async function resolveTarget(name: string, signal?: AbortSignal): Promise<Target | null> {
  signal?.throwIfAborted();
  const query = name.trim();
  const example = TARGETS.find((item) =>
    [item.name, item.id, ...(item.aliases ?? [])].some(
      (alias) => alias.toLowerCase() === query.toLowerCase(),
    ),
  );
  if (example) return example;
  if (!query || query.length > 100) return null;
  const url = `https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?${encodeURIComponent(query)}`;
  const combined = AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]);
  try {
    const response = await fetch(url, { signal: combined });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`CDS HTTP ${response.status}`);
    }
    const xml = (await readLimited(response, 256 * 1024)).toString('utf8');
    if (!/<Sesame\b/.test(xml)) throw new Error('Invalid CDS response');
    // Keep RA and Dec from the same resolver. No XML entities or markup are evaluated.
    for (const match of xml.matchAll(/<Resolver\b[^>]*>([\s\S]*?)<\/Resolver>/g)) {
      const ra = /<jradeg>\s*([^<]+)\s*<\/jradeg>/.exec(match[1]!);
      const dec = /<jdedeg>\s*([^<]+)\s*<\/jdedeg>/.exec(match[1]!);
      if (!ra || !dec) continue;
      const raDeg = Number(ra[1]),
        decDeg = Number(dec[1]);
      if (
        !Number.isFinite(raDeg) ||
        !Number.isFinite(decDeg) ||
        raDeg < 0 ||
        raDeg >= 360 ||
        Math.abs(decDeg) > 90
      ) {
        throw new Error('Invalid CDS coordinates');
      }
      return {
        id: `cds:${query}`,
        name: query,
        raDeg,
        decDeg,
        epoch: 'ICRS / J2000',
        sourceUrl: url,
      };
    }
    return null;
  } catch {
    signal?.throwIfAborted();
    throw new DomainError(
      'TARGET_RESOLVER_UNAVAILABLE',
      'Katalog CDS jest chwilowo niedostępny. Spróbuj ponownie.',
    );
  }
}
