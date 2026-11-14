/* global process, fetch, AbortSignal, console, setTimeout */
// Opt-in integration check against a running API and real IRSA products.
// It creates its own anonymous session; it never writes credentials to disk.
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.SPHEREX_API_URL ?? 'http://127.0.0.1:3000/api/v1';
const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173';
let cookie = '';
async function api(path, body, method = 'POST') {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : method, headers: { origin, cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const data = await response.json(); assert(response.ok, `${path}: ${JSON.stringify(data)}`); return data;
}
const report = { timestamp: new Date().toISOString(), dataMode: 'live', targets: [], sequence: null };
await api('/sessions', {});
const targets = await api('/targets');
for (const target of [...targets.filter(item => item.id !== 'wise-0855'), targets.find(item => item.id === 'wise-0855')]) {
  const view = await api('/view');
  const input = { raDeg: target.raDeg, decDeg: target.decDeg, fovDeg: .1, fromUtc: null, toUtc: null, release: 'dr1' };
  const search = await api('/observation-searches', { input, targetId: target.id, expectedRevision: view.viewRevision });
  assert.equal(search.dataMode, 'live');
  const entry = { name: target.name, input, count: search.observations.length, total: search.total, truncated: search.truncated, earliest: search.observations[0]?.observedAtUtc, latest: search.observations.at(-1)?.observedAtUtc, detectors: [...new Set(search.observations.map(item => item.detector))] };
  report.targets.push(entry); console.log(`${target.name}: ${entry.count} products (${input.release})`);
}
if (process.argv.includes('--images')) {
  const current = await api('/view'); const search = await api(`/observation-searches/${current.searchId}`);
  const observationIds = search.observations.filter(item => item.detector === 'SPHEREx-D1').slice(0, 24).map(item => item.id);
  const sequence = await api('/sequences', { searchId: search.id, observationIds, expectedRevision: current.viewRevision });
  const deadline = Date.now() + 10 * 60 * 1000;
  let status = ''; let job;
  do {
    job = await api(`/jobs/${sequence.jobId}`);
    if (`${job.status}:${job.progress}` !== status) { status = `${job.status}:${job.progress}`; console.log(`Imaging: ${status}`); }
    if (!['queued', 'running'].includes(job.status)) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  } while (Date.now() < deadline);
  assert.equal(job.status, 'ready', JSON.stringify(job.error));
  const ready = await api(`/sequences/${sequence.id}`); assert(ready.frames.length >= 2);
  for (const frame of ready.frames) {
    const response = await fetch(`${base}/sequences/${sequence.id}/frames/${frame.id}`, { headers: { cookie } }); assert(response.ok); const bytes = new Uint8Array(await response.arrayBuffer()); assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
  report.sequence = ready;
  const view = await api('/view'); assert.equal(view.sequenceId, ready.id);
  const changed = await api('/view', { patch: { mode: 'blink', playing: true, fps: 1 }, expectedRevision: view.viewRevision }, 'PATCH'); assert.equal(changed.playing, true);
  await api('/view', { patch: { playing: false }, expectedRevision: changed.viewRevision }, 'PATCH');
  console.log(`Verified ${ready.frames.length} real PNG frames, coverage ${(ready.frames[0].coverage * 100).toFixed(1)}%`);
}
// Reports contain product provenance, never the session cookie or OpenAI key.
if (report.sequence) { delete report.sequence.sessionId; delete report.sequence._id; }
await mkdir('output', { recursive: true });
await writeFile('output/live-verification.json', JSON.stringify(report, null, 2));
console.log('Report: output/live-verification.json');
