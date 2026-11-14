import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { beforeEach, expect, it, vi } from 'vitest';
const spawn = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ spawn }));
vi.mock('../src/config.js', () => ({ settings: { CACHE_ROOT: '/tmp/spherex-worker-test' } }));
import {
  analyzeFits,
  renderSequence,
  renderVideo,
} from '../src/modules/observations/imaging/worker-runner.js';

function childProcess() {
  return Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
}
beforeEach(() => spawn.mockReset());
it('preserves render cancellation, resource limits and the worker result envelope', async () => {
  const child = childProcess();
  spawn.mockReturnValue(child);
  const signal = new AbortController().signal;
  const pending = renderSequence('/tmp/manifest.json', signal);
  child.stdout.write(JSON.stringify({ ok: true, result: { frames: [], warnings: [] } }));
  child.emit('close', 0);
  await expect(pending).resolves.toEqual({ frames: [], warnings: [] });
  expect(spawn).toHaveBeenCalledWith(
    expect.stringContaining('workers/imaging/.venv/bin/python'),
    [
      expect.stringContaining('workers/imaging/worker.py'),
      '/tmp/spherex-worker-test',
      '/tmp/manifest.json',
    ],
    expect.objectContaining({ signal, timeout: 600000 }),
  );
});
it('rejects analysis output when the process fails even if it contains valid JSON', async () => {
  const child = childProcess();
  spawn.mockReturnValue(child);
  const pending = analyzeFits('/tmp/manifest.json');
  child.stdout.write('{}');
  child.emit('close', 1);
  await expect(pending).rejects.toMatchObject({ code: 'IMAGING_ERROR' });
});
it('kills a render process that exceeds the output cap', async () => {
  const child = childProcess();
  spawn.mockReturnValue(child);
  const pending = renderSequence('/tmp/manifest.json', new AbortController().signal);
  child.stdout.write(Buffer.alloc(1024 * 1024 + 1));
  child.emit('close', 1);
  expect(child.kill).toHaveBeenCalledOnce();
  await expect(pending).rejects.toMatchObject({ code: 'IMAGING_ERROR' });
});
it('preserves video worker timeout and checks its exit status', async () => {
  const child = childProcess();
  spawn.mockReturnValue(child);
  const pending = renderVideo('/tmp/video.json');
  child.emit('close', 1);
  await expect(pending).rejects.toMatchObject({ code: 'IMAGING_ERROR' });
  expect(spawn).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Array),
    expect.objectContaining({ timeout: 180000, stdio: ['ignore', 'ignore', 'pipe'] }),
  );
});
