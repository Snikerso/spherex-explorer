import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { DomainError, type Sequence } from '@spherex/contracts';
import { settings } from '../../../config.js';
import { cacheRoot, projectRoot } from './paths.js';

type WorkerOptions = {
  timeoutMs: number;
  maxOutputBytes: number;
  signal?: AbortSignal;
  captureOutput?: boolean;
};
function runWorker(
  script: 'worker.py' | 'analyze.py' | 'export_video.py' | 'reference.py',
  manifest: string,
  options: WorkerOptions,
): Promise<{ output: string; code: number | null }> {
  return new Promise((accept, reject) => {
    const child = spawn(
      settings.IMAGING_PYTHON ?? resolve(projectRoot, 'workers/imaging/.venv/bin/python'),
      [resolve(projectRoot, 'workers/imaging', script), cacheRoot, manifest],
      {
        signal: options.signal,
        timeout: options.timeoutMs,
        stdio: ['ignore', options.captureOutput === false ? 'ignore' : 'pipe', 'pipe'],
      },
    );
    let output = '',
      bytes = 0;
    child.stdout?.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > options.maxOutputBytes) child.kill();
      else output += chunk.toString();
    });
    child.stderr?.resume();
    child.on('error', reject);
    child.on('close', (code) => accept({ output, code }));
  });
}
export type RenderedSequence = Required<
  Pick<Sequence, 'frames' | 'grid' | 'stretch' | 'warnings'>
> &
  Pick<Sequence, 'bands' | 'pipelineVersion'>;
export async function renderSequence(
  manifest: string,
  signal: AbortSignal,
): Promise<RenderedSequence> {
  const { output } = await runWorker('worker.py', manifest, {
    signal,
    timeoutMs: 600000,
    maxOutputBytes: 1024 * 1024,
  });
  let data;
  try {
    data = JSON.parse(output);
  } catch {
    throw new DomainError(
      'IMAGING_ERROR',
      'Worker obrazów nie zwrócił prawidłowego wyniku. Uruchom uv sync w workers/imaging.',
    );
  }
  if (!data.ok) throw new DomainError(data.error.code, data.error.message);
  return data.result;
}
export async function analyzeFits(manifest: string): Promise<unknown> {
  const { output, code } = await runWorker('analyze.py', manifest, {
    timeoutMs: 120000,
    maxOutputBytes: 8 * 1024 * 1024,
  });
  try {
    if (code !== 0) throw new Error();
    return JSON.parse(output);
  } catch {
    throw new DomainError('IMAGING_ERROR', 'Nie udało się wykonać analizy FITS.');
  }
}
export async function renderVideo(manifest: string): Promise<void> {
  const { code } = await runWorker('export_video.py' | 'reference.py', manifest, {
    timeoutMs: 180000,
    maxOutputBytes: 0,
    captureOutput: false,
  });
  if (code !== 0)
    throw new DomainError(
      'IMAGING_ERROR',
      'Nie udało się utworzyć MP4. Sprawdź instalację workera.',
    );
}

export async function renderReference(manifest: string): Promise<{ image: string; timeStart: string | null; timeEnd: string | null }> {
  const { output, code } = await runWorker('reference.py', manifest, { timeoutMs: 60000, maxOutputBytes: 4 * 1024 * 1024 });
  try {
    if (code !== 0) throw new Error();
    const result = JSON.parse(output);
    if (typeof result.image !== 'string' || !result.image.startsWith('data:image/png;base64,')) throw new Error();
    return result;
  } catch { throw new DomainError('IMAGING_ERROR', 'Unable to render the WISE reference image.'); }
}
