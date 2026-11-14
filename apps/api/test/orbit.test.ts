import { expect, it, vi } from 'vitest';
import { SpacecraftOrbitProvider, parseSpacecraftTle } from '../src/modules/observations/orbit.js';
const tle = 'SPHEREX (MIDEX 9)\n1 63182U 25047E   26318.05429977  .00000956  00000+0  15185-3 0  9993\n2 63182  97.9569 140.1785 0011582  73.9821 286.2663 14.74308339 90127';
it('checks spacecraft identity, checksum and the TLE epoch', () => {
  expect(parseSpacecraftTle(tle).epochUtc).toMatch(/^2026-11-14T01:18:/);
  expect(() => parseSpacecraftTle(tle.replaceAll('63182', '63178'))).toThrow();
  expect(() => parseSpacecraftTle(tle.slice(0, -1) + '8')).toThrow();
});
it('deduplicates requests, caches orbital elements and marks stale fallback explicitly', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(tle));
  const provider = new SpacecraftOrbitProvider(request);
  const [a, b] = await Promise.all([provider.get(), provider.get()]);
  expect(a.line1).toBe(b.line1); expect(a.stale).toBe(false); expect(request).toHaveBeenCalledTimes(1);
  await provider.get(); expect(request).toHaveBeenCalledTimes(1);
  vi.useFakeTimers(); vi.setSystemTime(Date.now() + 3 * 3600000);
  request.mockRejectedValueOnce(new Error('offline'));
  try { expect((await provider.get()).stale).toBe(true); } finally { vi.useRealTimers(); }
});
