import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTarget } from '../src/modules/observations/resolve-target.js';

const xml =
  '<Sesame><Target><Resolver name="S"><jradeg>83.8201</jradeg><jdedeg>-5.3876</jdedeg></Resolver></Target></Sesame>';
afterEach(() => vi.unstubAllGlobals());
describe('target name resolution', () => {
  it('keeps local examples offline', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await resolveTarget('WISE 0855')).toMatchObject({ id: 'wise-0855' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('resolves M42 outside the examples to verified degrees', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(xml));
    vi.stubGlobal('fetch', fetch);
    expect(await resolveTarget('M42')).toMatchObject({
      id: 'cds:M42',
      raDeg: 83.8201,
      decDeg: -5.3876,
    });
    expect(fetch.mock.calls[0]![0]).toContain('?M42');
  });
  it('does not invent coordinates when the catalog has no match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<Sesame><Target/></Sesame>')));
    expect(await resolveTarget('No such object')).toBeNull();
  });
  it('distinguishes an unavailable resolver from an unknown object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(resolveTarget('M42')).rejects.toMatchObject({
      code: 'TARGET_RESOLVER_UNAVAILABLE',
    });
  });
  it('rejects invalid coordinates and does not combine different resolvers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(xml.replace('83.8201', '999'))));
    await expect(resolveTarget('M42')).rejects.toMatchObject({
      code: 'TARGET_RESOLVER_UNAVAILABLE',
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            '<Sesame><Resolver><jradeg>83</jradeg></Resolver><Resolver><jdedeg>-5</jdedeg></Resolver></Sesame>',
          ),
        ),
    );
    expect(await resolveTarget('M42')).toBeNull();
  });
  it('honors cancellation without making a request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(resolveTarget('M42', AbortSignal.abort())).rejects.toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
