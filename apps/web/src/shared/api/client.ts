import { t } from '../i18n/index';
import type { VideoRenderOptions } from '@spherex/contracts';
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = 'POST',
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method: body === undefined ? 'GET' : method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      data?.error?.code ?? 'NETWORK_ERROR',
      data?.error?.message ?? `API: HTTP ${response.status}`,
      response.status,
    );
  return data as T;
}

export async function downloadVideo(
  sequenceId: string,
  frameIds: string[],
  fps: number,
  options?: VideoRenderOptions,
) {
  const response = await fetch(`/api/v1/sequences/${sequenceId}/export`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frameIds, fps, options }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error?.message ?? `Eksport: HTTP ${response.status}`);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `spherex-${options?.color ? 'rgb-' : ''}${sequenceId}.mp4`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function downloadImage(dataUrl: string, filename: string) {
  if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error(t('Nieprawidłowy obraz PNG.'));
  const response = await fetch(dataUrl);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
