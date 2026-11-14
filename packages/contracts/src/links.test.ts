import { describe, expect, it } from 'vitest';
import { explorerLink, parseExplorerLink } from './links.js';
describe('coordinate query and embed links', () => {
  it('round-trips region, release and epoch filters without session identifiers', () => {
    const input = { raDeg: 359.9, decDeg: -70, fovDeg: 2, release: 'qr3', fromUtc: '2025-01-01T00:00:00Z', toUtc: '2025-12-31T23:59:59Z' };
    const url = new URL(explorerLink('https://example.org/?session=private#secret', input, true));
    expect(parseExplorerLink(url.search)).toEqual(input);
    expect(url.searchParams.get('embed')).toBe('1'); expect(url.searchParams.get('search')).toBe('1');
    expect(url.searchParams.has('session')).toBe(false); expect(url.hash).toBe('');
  });
  it('requires both coordinates and rejects invalid regions and dates', () => {
    for (const query of ['?ra=&dec=0', '?ra=10', '?ra=400&dec=0', '?ra=1&dec=2&fov=3', '?ra=1&dec=2&from=2026-01-01&to=2025-01-01']) expect(parseExplorerLink(query)).toBeNull();
    expect(parseExplorerLink('?ra=1&dec=2&from=2025-01-01')?.fromUtc).toBe('2025-01-01T00:00:00.000Z');
  });
});
