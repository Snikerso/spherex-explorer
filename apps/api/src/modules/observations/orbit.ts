import { DomainError } from '@spherex/contracts';
import { readLimited } from './irsa.js';
const sourceUrl = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=63182&FORMAT=TLE';
export function parseSpacecraftTle(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const line1 = lines.find((line) => line.startsWith('1 63182'));
  const line2 = lines.find((line) => line.startsWith('2 63182'));
  const valid = (line?: string) =>
    line?.length === 69 &&
    [...line.slice(0, 68)].reduce(
      (sum, character) =>
        sum + (/\d/.test(character) ? Number(character) : character === '-' ? 1 : 0),
      0,
    ) %
      10 ===
      Number(line[68]);
  if (!valid(line1) || !valid(line2))
    throw new DomainError('DATA_SCHEMA_ERROR', 'Nieprawidłowe elementy orbity SPHEREx.');
  const year = Number(line1!.slice(18, 20));
  const day = Number(line1!.slice(20, 32));
  if (!(day >= 1 && day < 367))
    throw new DomainError('DATA_SCHEMA_ERROR', 'Nieprawidłowa epoka TLE.');
  const epochUtc = new Date(
    Date.UTC(year < 57 ? 2000 + year : 1900 + year, 0, 1) + (day - 1) * 86400000,
  ).toISOString();
  return { line1: line1!, line2: line2!, epochUtc, sourceUrl, noradId: 63182 };
}
type OrbitData = ReturnType<typeof parseSpacecraftTle> & { fetchedAt: string; stale: boolean };
export class SpacecraftOrbitProvider {
  private cached?: ReturnType<typeof parseSpacecraftTle> & { fetchedAt: string };
  private pending?: Promise<OrbitData>;
  constructor(private readonly request: typeof fetch = fetch) {}
  async get(): Promise<OrbitData> {
    if (this.cached && Date.now() - Date.parse(this.cached.fetchedAt) < 2 * 3600000)
      return { ...this.cached, stale: false };
    if (this.pending) return this.pending;
    const operation = async () => {
      try {
        const response = await this.request(sourceUrl, {
          signal: AbortSignal.timeout(12000),
          redirect: 'error',
        });
        if (!response.ok) throw new Error('CelesTrak unavailable');
        const parsed = parseSpacecraftTle((await readLimited(response, 8192)).toString('utf8'));
        this.cached = { ...parsed, fetchedAt: new Date().toISOString() };
        return { ...this.cached, stale: false };
      } catch {
        if (this.cached) return { ...this.cached, stale: true };
        throw new DomainError(
          'DATA_SOURCE_ERROR',
          'Brak aktualnych elementów orbity. Dostępny jest schemat poglądowy.',
        );
      }
    };
    this.pending = operation();
    try {
      return await this.pending;
    } finally {
      this.pending = undefined;
    }
  }
}
