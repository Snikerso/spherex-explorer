import { t } from '../../../shared/i18n/index';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { rgbValues, type RgbChannel, type RenderFrame } from '@spherex/contracts';

const cache = new Map<string, Promise<Float32Array>>();
function samples(sequenceId: string, frame: RenderFrame, size: number) {
  const key = `${sequenceId}/${frame.id}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      const url = `/api/v1/sequences/${sequenceId}/frames/${frame.id}`;
      if (frame.radianceName) {
        const response = await fetch(`${url}/radiance`, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(t('Nie udało się wczytać danych jasności.'));
        const values = new Float32Array(await response.arrayBuffer());
        if (values.length !== size * size) throw new Error(t('Niepoprawny rozmiar obrazu.'));
        return values;
      }
      // Older sequences remain viewable; rerendering is needed to recover clipped highlights.
      const response = await fetch(`${url}?quality=off`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(t('Nie udało się wczytać obrazu.'));
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d')!;
      context.drawImage(bitmap, 0, 0, size, size);
      bitmap.close();
      const pixels = context.getImageData(0, 0, size, size).data;
      return Float32Array.from({ length: size * size }, (_, i) =>
        pixels[i * 4 + 3] ? Math.sinh((pixels[i * 4]! / 255) * Math.asinh(10)) / 10 : NaN,
      );
    })();
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
    if (cache.size > 128) cache.delete(cache.keys().next().value!);
  }
  return pending;
}

export type SkyImageHandle = { downloadPng: (filename: string) => Promise<void> };

export function SkyImage({
  sequenceId,
  frames,
  size,
  exposure,
  color = false,
  channels,
  downloadRef,
  label,
}: {
  sequenceId: string;
  frames: RenderFrame[];
  size: number;
  exposure: number;
  color?: boolean;
  channels?: RgbChannel[];
  downloadRef?: Ref<SkyImageHandle>;
  label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<{ key: string; values: Float32Array[] } | null>(null);
  const [error, setError] = useState('');
  const key = `${sequenceId}/${size}/${frames.map((frame) => frame.id).join(',')}`;
  const signature = JSON.stringify([key, exposure, color, channels]);
  useImperativeHandle(
    downloadRef,
    () => ({
      async downloadPng(filename: string) {
        const image = canvas.current;
        if (!image || image.dataset.renderSignature !== signature)
          throw new Error(t('Obraz jeszcze się wczytuje. Spróbuj ponownie za chwilę.'));
        const blob = await new Promise<Blob>((resolve, reject) =>
          image.toBlob(
            (value) =>
              value ? resolve(value) : reject(new Error(t('Nie udało się zapisać PNG.'))),
            'image/png',
          ),
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
    }),
    [signature],
  );
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    Promise.all(frames.map((frame) => samples(sequenceId, frame, size)))
      .then((values) => {
        if (active) setData({ key, values });
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : t('Błąd obrazu'));
      });
    return () => {
      active = false;
    };
    // Frame IDs identify immutable samples; brightness never triggers another download.
  }, [sequenceId, key, size]);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, size, size);
    if (canvas.current) canvas.current.dataset.renderSignature = '';
    if (!data || data.key !== key) return;
    const image = context.createImageData(size, size);
    const gain = 2 ** exposure;
    const tone = (value: number) =>
      Math.min(
        255,
        Math.round((Math.asinh(10 * gain * Math.max(0, value)) / Math.asinh(10)) * 255),
      );
    for (let pixel = 0; pixel < size * size; pixel++) {
      const values = data.values.map((samples) => samples[pixel]!);
      const rgb = color
        ? rgbValues(
            values,
            frames.map((frame) => frame.detector ?? ''),
            channels ?? [
              { enabled: true, detector: 'auto' },
              { enabled: true, detector: 'auto' },
              { enabled: true, detector: 'auto' },
            ],
          )
        : Number.isFinite(values[0])
          ? [values[0]!, values[0]!, values[0]!]
          : null;
      if (!rgb) continue;
      for (let channel = 0; channel < 3; channel++)
        image.data[pixel * 4 + channel] = tone(rgb[channel]!);
      image.data[pixel * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    if (canvas.current) canvas.current.dataset.renderSignature = signature;
  }, [data, exposure, color, size, channels, key, signature]);
  return (
    <>
      <canvas ref={canvas} width={size} height={size} role="img" aria-label={label} />
      {error && (
        <span className="image-error" role="alert">
          {t(error)}
        </span>
      )}
    </>
  );
}
