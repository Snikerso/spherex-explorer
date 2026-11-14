import { z } from 'zod';
export const gaiaSourceSchema = z.object({
  id: z.string().regex(/^\d+$/), raDeg: z.number().min(0).lt(360), decDeg: z.number().min(-90).max(90),
  epoch: z.number(), pmra: z.number().nullable(), pmdec: z.number().nullable(),
  parallaxMas: z.number().nullable(), magnitude: z.number().nullable(),
});
export type GaiaSource = z.infer<typeof gaiaSourceSchema>;
export const gaiaResultSchema = z.object({ sources: z.array(gaiaSourceSchema), truncated: z.boolean(), radiusDeg: z.number(), catalog: z.literal('Gaia DR3') });
export type GaiaResult = z.infer<typeof gaiaResultSchema>;
export type WiseReference = { image: string; sourceUrl: string; band: 'W1' | 'W2'; timeStart: string | null; timeEnd: string | null };
/** Tangential proper motion only; no observer parallax or radial-velocity/perspective correction. */
export function gaiaPosition(source: GaiaSource, utc: string) {
  if (source.pmra === null || source.pmdec === null) return { raDeg: source.raDeg, decDeg: source.decDeg, propagated: false };
  const ms = Date.parse(utc);
  if (!Number.isFinite(ms)) return { raDeg: source.raDeg, decDeg: source.decDeg, propagated: false };
  const years = 2000 + (ms - Date.parse('2000-01-01T12:00:00Z')) / (365.25 * 86400000) - source.epoch;
  const r = Math.PI / 180, ra = source.raDeg * r, dec = source.decDeg * r;
  const scale = years * r / 3600000;
  const x = Math.cos(dec) * Math.cos(ra) + scale * (-source.pmra * Math.sin(ra) - source.pmdec * Math.sin(dec) * Math.cos(ra));
  const y = Math.cos(dec) * Math.sin(ra) + scale * (source.pmra * Math.cos(ra) - source.pmdec * Math.sin(dec) * Math.sin(ra));
  const z = Math.sin(dec) + scale * source.pmdec * Math.cos(dec);
  return { raDeg: (Math.atan2(y, x) / r + 360) % 360, decDeg: Math.atan2(z, Math.hypot(x, y)) / r, propagated: true };
}
