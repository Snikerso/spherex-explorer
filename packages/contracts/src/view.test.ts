import { describe, expect, it } from 'vitest';
import { applyViewPatch, initialView, manualViewRequestSchema, searchInputSchema } from './index.js';

describe('kontrakty wspólnego stanu', () => {
  const input = { raDeg: 0, decDeg: -90, fovDeg: 0.1, fromUtc: null, toUtc: null, release: 'qr3' };
  it('akceptuje granice układu współrzędnych i odrzuca RA=360', () => {
    expect(searchInputSchema.safeParse(input).success).toBe(true);
    expect(searchInputSchema.safeParse({ ...input, raDeg: 360 }).success).toBe(false);
    expect(searchInputSchema.safeParse({ ...input, decDeg: 90 }).success).toBe(true);
  });
  it('odrzuca odwrócone daty i nadmierne pole', () => {
    expect(searchInputSchema.safeParse({ ...input, fromUtc: '2026-01-02T00:00:00Z', toUtc: '2026-01-01T00:00:00Z' }).success).toBe(false);
    expect(searchInputSchema.safeParse({ ...input, fovDeg: 0.6 }).success).toBe(false);
  });
  it('nie pozwala klientowi wybrać źródła zmiany lub referencji do cudzej sekwencji', () => {
    expect(manualViewRequestSchema.safeParse({ expectedRevision: 0, patch: { lastChangedBy: 'agent' } }).success).toBe(false);
    expect(manualViewRequestSchema.safeParse({ expectedRevision: 0, patch: { sequenceId: 'private-sequence' } }).success).toBe(false);
  });
  it('zachowuje ręczną poprawkę i odrzuca starszą rewizję', () => {
    const changed = applyViewPatch(initialView(), { fps: 1 }, 0, 'user');
    expect(() => applyViewPatch(changed, { fps: 3 }, 0, 'agent')).toThrow('Ustawienia zmieniły się');
    expect(changed.fps).toBe(1);
  });
  it('nie uruchamia animacji bez klatek', () => {
    expect(() => applyViewPatch(initialView(), { playing: true }, 0, 'agent')).toThrow('Odtwarzanie wymaga');
  });
});
