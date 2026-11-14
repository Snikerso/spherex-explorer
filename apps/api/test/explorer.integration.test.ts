import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Store } from '../src/database/store.js';

const input = { raDeg: 133.79512917, decDeg: -7.24514722, fovDeg: .1, fromUtc: null, toUtc: null, release: 'dr1' };
const observation = { id: 'real-source-id', observedAtUtc: '2025-05-07T00:00:00Z', detector: 'SPHEREx-D1', comparisonGroup: 'dr1:SPHEREx-D1', sourceUrl: 'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/test.fits' };
describe('Explorer REST: ownership, live search, cancellation and SSE replay', () => {
  let mongo: MongoMemoryReplSet;
  let app: INestApplication;
  let store: Store;
  let base: string;
  let cacheRoot: string;
  const directories: string[] = [];
  const origin = 'http://localhost:5173';
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ binary: { version: '8.0.17' }, replSet: { count: 1 } });
    process.env.MONGODB_URI = mongo.getUri('explorer_test'); process.env.NODE_ENV = 'test'; process.env.APP_ORIGIN = origin;
    const { createApp } = await import('../src/bootstrap.js');
    const storeModule = await import('../src/database/store.js');
    cacheRoot = (await import('../src/modules/observations/observations.service.js')).cacheRoot;
    app = await createApp(); await app.listen(0, '127.0.0.1');
    store = app.get(storeModule.Store); base = `${await app.getUrl()}/api/v1`;
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await app?.close(); await mongo?.stop(); for (const directory of directories) await rm(directory, { recursive: true, force: true }); });
  async function session() {
    const response = await fetch(`${base}/sessions`, { method: 'POST', headers: { origin } });
    return { cookie: response.headers.get('set-cookie')!.split(';')[0]!, sessionId: (await response.json()).sessionId as string };
  }
  function call(path: string, cookie: string, body?: unknown, method = 'POST', extra: Record<string, string> = {}) {
    return fetch(base + path, { method: body === undefined ? 'GET' : method, headers: { cookie, origin, 'content-type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  it('queries IRSA through the adapter, persists live results and isolates another session', async () => {
    const { IrsaClient } = await import('../src/modules/observations/irsa.js');
    const search = vi.spyOn(IrsaClient.prototype, 'search').mockResolvedValue([observation]);
    const a = await session(); const b = await session();
    const response = await call('/observation-searches', a.cookie, { input, targetId: 'wise-0855', expectedRevision: 0 });
    expect(response.status).toBe(201);
    const result = await response.json(); expect(result.dataMode).toBe('live'); expect(result.observations).toHaveLength(1); expect(search).toHaveBeenCalledOnce();
    expect((await call(`/observation-searches/${result.id}`, a.cookie)).status).toBe(200);
    expect((await call(`/observation-searches/${result.id}`, b.cookie)).status).toBe(404);
    const view = await (await call('/view', a.cookie)).json(); expect(view.searchId).toBe(result.id); expect(view.searchInput).toEqual(input);
    expect((await call('/observation-searches', a.cookie, { input, targetId: null, expectedRevision: 0 })).status).toBe(409);
  });
  it('rejects malformed coordinates before calling the archive and handles an empty result', async () => {
    const { IrsaClient } = await import('../src/modules/observations/irsa.js');
    const search = vi.spyOn(IrsaClient.prototype, 'search').mockResolvedValue([]); const a = await session();
    expect((await call('/observation-searches', a.cookie, { input: { ...input, raDeg: 400 }, targetId: null, expectedRevision: 0 })).status).toBe(400); expect(search).not.toHaveBeenCalled();
    const response = await call('/observation-searches', a.cookie, { input, targetId: null, expectedRevision: 0 }); expect((await response.json()).observations).toEqual([]);
  });
  it('serves frame bytes only to the owner and refuses foreign frame references', async () => {
    const a = await session(); const b = await session(); const id = randomUUID(); const frameId = randomUUID();
    const directory = join(cacheRoot, 'sequences', id); directories.push(directory); await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'frame.f32'), new Uint8Array(new Float32Array([0.5]).buffer));
    await writeFile(join(directory, 'frame.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aImkAAAAASUVORK5CYII=', 'base64'));
    await store.collection('sequences').insertOne({ id, sessionId: a.sessionId, status: 'ready', frameIds: [frameId], frames: [{ id: frameId, radianceName: 'frame.f32', imageName: 'frame.png', unmaskedImageName: 'frame.png' }] });
    const frame = await call(`/sequences/${id}/frames/${frameId}`, a.cookie); expect(frame.status).toBe(200); expect(frame.headers.get('content-type')).toContain('image/png'); expect((await frame.arrayBuffer()).byteLength).toBeGreaterThan(50);
    expect((await call(`/sequences/${id}/frames/${frameId}`, b.cookie)).status).toBe(404);
    const radiance = await call(`/sequences/${id}/frames/${frameId}/radiance`, a.cookie); expect(radiance.status).toBe(200); expect(new Float32Array(await radiance.arrayBuffer())[0]).toBe(.5);
    expect((await call(`/sequences/${id}/frames/${frameId}/radiance`, b.cookie)).status).toBe(404);
    expect((await call(`/sequences/${id}/frames/${frameId}?quality=off`, a.cookie)).status).toBe(200);
    expect((await call(`/sequences/${id}/frames/${frameId}?quality=off`, b.cookie)).status).toBe(404);
    expect((await call(`/sequences/${id}/frames/${frameId}?quality=anything`, a.cookie)).status).toBe(400);
    expect((await call(`/sequences/${id}/frames/${randomUUID()}`, a.cookie)).status).toBe(404);
    expect((await call('/view', a.cookie, { expectedRevision: 0, patch: { frameIds: [frameId] } }, 'PATCH')).status).toBe(409);
  });
  it('cancels a job idempotently and protects it from another session', async () => {
    const a = await session(); const b = await session(); const id = randomUUID(); const sequenceId = randomUUID();
    await store.collection('jobs').insertOne({ id, sessionId: a.sessionId, sequenceId, active: true, status: 'queued', progress: 0 });
    await store.collection('sequences').insertOne({ id: sequenceId, sessionId: a.sessionId, status: 'queued' });
    expect((await call(`/jobs/${id}/cancel`, b.cookie, {})).status).toBe(404);
    const first = await call(`/jobs/${id}/cancel`, a.cookie, {}); expect((await first.json()).status).toBe('cancelled');
    const second = await call(`/jobs/${id}/cancel`, a.cookie, {}); expect((await second.json()).active).toBe(false);
  });
  it('replays SSE after Last-Event-ID and does not leak another conversation', async () => {
    const a = await session(); const b = await session(); const id = randomUUID();
    await store.collection('runs').insertOne({ id, sessionId: a.sessionId, clientRequestId: randomUUID(), active: false, status: 'completed' });
    for (const [index, type] of ['run.started', 'message.delta', 'run.completed'].entries()) await store.collection('runEvents').insertOne({ sessionId: a.sessionId, runId: id, seq: index + 1, schemaVersion: 1, type, payload: { content: 'test' }, timestamp: new Date().toISOString() });
    const response = await call(`/agent/runs/${id}/events`, a.cookie, undefined, 'GET', { 'last-event-id': `${id}:1` });
    const text = await response.text(); expect(response.headers.get('content-type')).toContain('text/event-stream'); expect(text).not.toContain('event: run.started'); expect(text).toContain('event: message.delta'); expect(text).toContain(`id: ${id}:3`);
    expect((await call(`/agent/runs/${id}/events`, b.cookie)).status).toBe(404);
  });
  it('prepares selected detectors together without collapsing selection to a single detector', async () => {
    const a = await session(); const searchId = randomUUID();
    const { WorkspaceService } = await import('../src/modules/workspace/workspace.service.js');
    const { ObservationsService } = await import('../src/modules/observations/observations.service.js');
    const observations = ['SPHEREx-D1', 'SPHEREx-D4'].flatMap(detector => Array.from({ length: 30 }, (_, index) => index).map(index => ({ ...observation, detector, id: `${detector}-${index}`, comparisonGroup: `dr1:${detector}`, observedAtUtc: new Date(Date.UTC(2025, 4, index + 1)).toISOString() })));
    await store.collection('searches').insertOne({ id: searchId, sessionId: a.sessionId, input, observations: [...observations, { ...observations[0], id: 'not-selected', observedAtUtc: '2025-05-03T00:00:00Z' }] });
    const view = await app.get(WorkspaceService).patch(a.sessionId, { searchId }, 0, 'system');
    const queued = { id: randomUUID(), sessionId: a.sessionId, jobId: randomUUID(), status: 'queued' as const, observationIds: observations.map(item => item.id), frameIds: [] };
    const prepare = vi.spyOn(app.get(ObservationsService), 'prepare').mockResolvedValue(queued);
    const response = await call('/band-sequences', a.cookie, { searchId, detectors: ['SPHEREx-D1', 'SPHEREx-D4'], expectedRevision: view.viewRevision, observationIds: observations.map(item => item.id) });
    expect(response.status).toBe(202);
    expect(prepare).toHaveBeenCalledWith(a.sessionId, observations.map(item => item.id), undefined, true);
    const saved = await (await call('/view', a.cookie)).json(); expect(saved.selectedObservationIds).toHaveLength(60); expect(saved.jobId).toBe(queued.jobId);
    expect((await call('/band-sequences', a.cookie, { searchId, detectors: ['SPHEREx-D1', 'SPHEREx-D1'], expectedRevision: saved.viewRevision })).status).toBe(400);
  });
  it('exports MP4 with the chosen frames and tempo and denies foreign sequences', async () => {
    const a = await session(); const id = randomUUID(); const frameId = randomUUID();
    expect((await call(`/sequences/${id}/export`, a.cookie, { frameIds: [frameId], fps: 2.5 })).status).toBe(404);
    const { ObservationsService } = await import('../src/modules/observations/observations.service.js');
    const exportVideo = vi.spyOn(app.get(ObservationsService), 'exportVideo').mockResolvedValue(Buffer.from('video-content'));
    const response = await call(`/sequences/${id}/export`, a.cookie, { frameIds: [frameId], fps: 2.5 });
    expect(response.headers.get('content-type')).toContain('video/mp4');
    expect(response.headers.get('content-disposition')).toContain('.mp4');
    expect(await response.text()).toBe('video-content');
    expect(exportVideo).toHaveBeenCalledWith(a.sessionId, id, [frameId], 2.5);
    const options = { color: true, exposure: -2.3, epochHours: 168, channels: [{ enabled: true, detector: 'SPHEREx-D2' }, { enabled: false, detector: 'auto' }, { enabled: true, detector: 'SPHEREx-D1' }] };
    const rgb = await call(`/sequences/${id}/export`, a.cookie, { frameIds: [frameId], fps: 1, options });
    expect(rgb.status).toBe(200); expect(rgb.headers.get('content-disposition')).toContain('spherex-rgb-');
    expect(exportVideo).toHaveBeenLastCalledWith(a.sessionId, id, [frameId], 1, options);
    expect((await call(`/sequences/${id}/export`, a.cookie, { frameIds: [frameId], fps: 1, options: { ...options, exposure: 9 } })).status).toBe(400);

  });
  it('protects exploratory analyses and validates wavelength ranges', async () => {
    const a = await session(); const id = randomUUID();
    const body = { kind: 'spectrum', point: { raDeg: 133, decDeg: -7 }, rangeUm: [.7, 5.1] };
    expect((await call(`/sequences/${id}/analyze`, a.cookie, body)).status).toBe(404);
    expect((await call(`/sequences/${id}/analyze`, a.cookie, { kind: 'compare', operation: 'subtract', observationIds: ['a', 'b'], rangeUm: [.7, 5.1] })).status).toBe(404);
    expect((await call(`/sequences/${id}/analyze`, a.cookie, { kind: 'compare', operation: 'add', observationIds: ['a', 'a'], rangeUm: [.7, 5.1] })).status).toBe(400);
    expect((await call(`/sequences/${id}/analyze`, a.cookie, { kind: 'metadata', rangeUm: [.7, 5.1] })).status).toBe(400);
    expect((await call(`/sequences/${id}/analyze`, a.cookie, { ...body, rangeUm: [5, 1] })).status).toBe(400);
    const { ObservationsService } = await import('../src/modules/observations/observations.service.js');
    const analysis = vi.spyOn(app.get(ObservationsService), 'analyze').mockResolvedValue({ kind: 'spectrum', points: [], skipped: [] });
    expect((await call(`/sequences/${id}/analyze`, a.cookie, body)).status).toBe(200);
    expect(analysis).toHaveBeenCalledWith(a.sessionId, id, body);
    const releases = await (await call('/data-releases', a.cookie)).json();
    expect(releases.releases.some((release: { id: string }) => release.id === releases.defaultRelease)).toBe(true);
  });
  it('switches prepared bands while refusing mixed-wavelength playback', async () => {
    const a = await session(); const id = randomUUID();
    const { WorkspaceService } = await import('../src/modules/workspace/workspace.service.js');
    await store.collection('sequences').insertOne({ id, sessionId: a.sessionId, status: 'ready', frameIds: ['a1', 'a2', 'b1', 'b2'], bands: [
      { detector: 'SPHEREx-D1', status: 'ready', frameIds: ['a1', 'a2'] },
      { detector: 'SPHEREx-D4', status: 'ready', frameIds: ['b1', 'b2'] },
    ] });
    const view = await app.get(WorkspaceService).patch(a.sessionId, { sequenceId: id, frameIds: ['a1', 'a2'] }, 0, 'system');
    expect((await call('/view', a.cookie, { expectedRevision: view.viewRevision, patch: { frameIds: ['a1', 'b1'], playing: true } }, 'PATCH')).status).toBe(422);
    const response = await call('/view', a.cookie, { expectedRevision: view.viewRevision, patch: { frameIds: ['b1', 'b2'], playing: false } }, 'PATCH');
    expect(response.status).toBe(200); expect((await response.json()).frameIds).toEqual(['b1', 'b2']);
  });
  it('reuses an agent run idempotently without a second model invocation', async () => {
    const a = await session(); const id = randomUUID(); const clientRequestId = randomUUID();
    await store.collection('runs').insertOne({ id, sessionId: a.sessionId, clientRequestId, active: false, status: 'completed' });
    const response = await call('/agent/runs', a.cookie, { message: 'test', clientRequestId }); expect((await response.json()).id).toBe(id);
    expect(await store.collection('runs').countDocuments({ sessionId: a.sessionId })).toBe(1);
  });
});
