import { t } from '../../shared/i18n/index';
import { useEffect, useRef, useState } from 'react';

type Stack = {
  detector: string;
  image: string;
  count: number;
  sources: { observedAtUtc: string }[];
};
export function StackRgbComposer({ stacks }: { stacks: Stack[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [channels, setChannels] = useState(
    [0, 1, 2].map(() => ({ enabled: true, detector: 'auto' })),
  );
  const [exposure, setExposure] = useState(-1);
  const [samples, setSamples] = useState<{
    source: Stack[];
    data: Map<string, Float32Array>;
  } | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const ordered = [...stacks].sort((a, b) => a.detector.localeCompare(b.detector));
  const automatic = [
    ordered.at(-1)?.detector,
    ordered[Math.floor((ordered.length - 1) / 2)]?.detector,
    ordered[0]?.detector,
  ];
  const assigned = channels.map((channel, index) =>
    channel.detector === 'auto' ? (automatic[index] ?? '') : channel.detector,
  );
  const signature = JSON.stringify([
    assigned,
    channels.map((channel) => channel.enabled),
    exposure,
  ]);
  useEffect(() => {
    let active = true;
    setSamples(null);
    setReady(false);
    setError('');
    Promise.all(
      stacks.map(async (stack) => {
        const response = await fetch(stack.image);
        const bitmap = await createImageBitmap(await response.blob());
        const image = document.createElement('canvas');
        image.width = image.height = 256;
        const context = image.getContext('2d')!;
        context.drawImage(bitmap, 0, 0, 256, 256);
        bitmap.close();
        const pixels = context.getImageData(0, 0, 256, 256).data;
        const values = Float32Array.from({ length: 256 * 256 }, (_, i) =>
          pixels[i * 4 + 3] ? Math.sinh((pixels[i * 4]! / 255) * Math.asinh(10)) / 10 : NaN,
        );
        return [stack.detector, values] as const;
      }),
    )
      .then((entries) => {
        if (active) setSamples({ source: stacks, data: new Map(entries) });
      })
      .catch(() => {
        if (active) setError(t('Nie udało się wczytać stacków.'));
      });
    return () => {
      active = false;
    };
  }, [stacks]);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    setReady(false);
    if (canvas.current) canvas.current.dataset.renderSignature = '';
    context.clearRect(0, 0, 256, 256);
    if (!samples || samples.source !== stacks) return;
    const sampleMap = samples.data;
    const configuration: [string[], boolean[], number] = JSON.parse(signature);
    const [detectors, enabled, ev] = configuration;
    if (detectors.some((detector, index) => enabled[index] && !sampleMap.has(detector))) return;
    const image = context.createImageData(256, 256);
    for (let pixel = 0; pixel < 256 * 256; pixel++) {
      const values = detectors.map((detector, index) =>
        enabled[index] ? sampleMap.get(detector)![pixel]! : 0,
      );
      if (!values.every(Number.isFinite)) continue;
      if (
        !enabled.some(Boolean) &&
        ![...sampleMap.values()].some((values) => Number.isFinite(values[pixel]))
      )
        continue;
      for (let channel = 0; channel < 3; channel++)
        image.data[pixel * 4 + channel] = Math.min(
          255,
          Math.round(
            (Math.asinh(10 * 2 ** ev * Math.max(0, values[channel]!)) / Math.asinh(10)) * 255,
          ),
        );
      image.data[pixel * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    if (canvas.current) canvas.current.dataset.renderSignature = signature;
    setReady(true);
  }, [samples, signature, stacks]);
  async function download() {
    if (!canvas.current || !ready || canvas.current.dataset.renderSignature !== signature) return;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.current!.toBlob(resolve, 'image/png'),
    );
    if (!blob) {
      setError(t('Nie udało się zapisać PNG.'));
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spherex-stack-rgb-${assigned.map((detector, index) => `${['R', 'G', 'B'][index]}-${channels[index]!.enabled ? detector.replace('SPHEREx-', '') : 'off'}`).join('_')}-${exposure}EV.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  if (!stacks.length) return null;
  return (
    <section className="stack-rgb-composer" aria-label={t('Kolorowy obraz ze stacków')}>
      <h3>{t('Połącz stacki w RGB')}</h3>
      <div className="rgb-channel-controls">
        {['R', 'G', 'B'].map((name, index) => (
          <div className={`rgb-channel channel-${name.toLowerCase()}`} key={name}>
            <label>
              <input
                type="checkbox"
                aria-label={t('Włącz kanał stacku {0}', name)}
                checked={channels[index]!.enabled}
                onChange={(event) =>
                  setChannels((values) =>
                    values.map((value, i) =>
                      i === index ? { ...value, enabled: event.target.checked } : value,
                    ),
                  )
                }
              />
              <b>{name}</b>
            </label>
            <select
              aria-label={t('Stack kanału {0}', name)}
              value={channels[index]!.detector}
              disabled={!channels[index]!.enabled}
              onChange={(event) =>
                setChannels((values) =>
                  values.map((value, i) =>
                    i === index ? { ...value, detector: event.target.value } : value,
                  ),
                )
              }
            >
              <option value="auto">Auto ({automatic[index]?.replace('SPHEREx-', '')})</option>
              {[1, 2, 3, 4, 5, 6].map((number) => (
                <option
                  key={number}
                  value={`SPHEREx-D${number}`}
                  disabled={!stacks.some((stack) => stack.detector === `SPHEREx-D${number}`)}
                >
                  Stack D{number}
                  {stacks.some((stack) => stack.detector === `SPHEREx-D${number}`)
                    ? ''
                    : t(' · brak danych')}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="discovery-toolbar">
        <label>
          {t('Jasność ')}
          <input
            aria-label={t('Jasność kompozycji stacków')}
            type="range"
            min="-6"
            max="2"
            step=".1"
            value={exposure}
            onChange={(event) => setExposure(Number(event.target.value))}
          />
          <output>{exposure.toFixed(1)} EV</output>
        </label>
        <button
          disabled={!ready}
          onClick={() => {
            void download();
          }}
        >
          ↓ RGB stack PNG
        </button>
      </div>
      <canvas
        ref={canvas}
        width="256"
        height="256"
        role="img"
        aria-label={t('Kolorowy obraz RGB ze stacków')}
      />
      {!ready && !error && <p>{t('Wczytywanie lub brak wybranego stacku w tym zakresie.')}</p>}
      {error && <p role="alert">{t(error)}</p>}
      <details>
        <summary>{t('Źródła kanałów i daty')}</summary>
        {assigned.map((detector, index) => {
          const stack = stacks.find((stack) => stack.detector === detector);
          const dates = stack?.sources.map((source) => source.observedAtUtc).sort();
          return (
            <p key={index}>
              {['R', 'G', 'B'][index]} ·{' '}
              {channels[index]!.enabled
                ? t(
                    '{0} · {1} zdjęć · {2} — {3}',
                    detector.replace('SPHEREx-', ''),
                    stack?.count ?? 0,
                    dates?.[0] ?? '—',
                    dates?.at(-1) ?? '—',
                  )
                : t('wyłączony')}
            </p>
          );
        })}
      </details>
      <p className="help">
        {t(
          'Kolory umowne z podglądów stacków, każdy z własnym kontrastem. Łączą różne długości fali i daty; nie są jednoczesną obserwacją ani skalibrowanym pomiarem koloru. Suwak zmienia jasność podglądu, bez odzyskiwania bieli już obciętej w stackach.',
        )}
      </p>
    </section>
  );
}
