import { searchInputSchema, type SearchInput } from './index.js';
export function parseExplorerLink(query: string): SearchInput | null {
  const params = new URLSearchParams(query);
  if (!params.get('ra')?.trim() || !params.get('dec')?.trim()) return null;
  const date = (name: string) => { const value = params.get(name); return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${name === 'to' ? '23:59:59.999' : '00:00:00.000'}Z` : value; };
  const parsed = searchInputSchema.safeParse({ raDeg: Number(params.get('ra')), decDeg: Number(params.get('dec')), fovDeg: Number(params.get('fov') ?? '.1'), release: params.get('release') ?? 'dr1', fromUtc: date('from'), toUtc: date('to') });
  return parsed.success ? parsed.data : null;
}
export function explorerLink(base: string, input: SearchInput, embed = false) {
  const validated = searchInputSchema.parse(input); const url = new URL(base);
  url.search = new URLSearchParams({ ra: String(validated.raDeg), dec: String(validated.decDeg), fov: String(validated.fovDeg), release: validated.release, search: '1', ...(validated.fromUtc ? { from: validated.fromUtc } : {}), ...(validated.toUtc ? { to: validated.toUtc } : {}), ...(embed ? { embed: '1' } : {}) }).toString();
  url.hash = ''; return url.toString();
}
