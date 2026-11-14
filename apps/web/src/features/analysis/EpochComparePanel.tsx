import { t } from '../../shared/i18n/index';
import { useEffect, useState } from 'react';
import type { RenderFrame } from '@spherex/contracts';
import { api, downloadImage } from '../../shared/api/client';
import type { Quality } from '../../shared/api/analysis-types';
type Result = {
  image: string;
  coverage: number;
  valueMin: number;
  valueMax: number;
  spectrallyDifferent: boolean;
  sources: Quality[];
};
export function EpochComparePanel({
  sequenceId,
  frames,
  initialFrameId,
  close,
}: {
  sequenceId: string;
  frames: RenderFrame[];
  initialFrameId?: string;
  close: () => void;
}) {
  const initial = frames.find((frame) => frame.id === initialFrameId) ?? frames[0];
  const alternative =
    frames
      .filter(
        (frame) =>
          frame.observationId !== initial?.observationId &&
          frame.detector === initial?.detector &&
          frame.observedAtUtc !== initial?.observedAtUtc,
      )
      .sort(
        (left, right) =>
          Math.abs(left.wavelengthUm - initial!.wavelengthUm) -
            Math.abs(right.wavelengthUm - initial!.wavelengthUm) ||
          Date.parse(right.observedAtUtc) - Date.parse(left.observedAtUtc),
      )[0] ?? frames.find((frame) => frame.observationId !== initial?.observationId);
  const [a, setA] = useState(initial?.observationId ?? '');
  const [b, setB] = useState(alternative?.observationId ?? '');
  const [operation, setOperation] = useState<'add' | 'subtract'>('subtract');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setResult(null);
    setError('');
    if (!a || !b || a === b) {
      setBusy(false);
      setError(t('Wybierz dwie różne obserwacje.'));
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    const timer = setTimeout(() => {
      api<Result>(
        `/sequences/${sequenceId}/analyze`,
        { kind: 'compare', operation, observationIds: [a, b], rangeUm: [0.7, 5.1] },
        'POST',
        controller.signal,
      )
        .then(setResult)
        .catch((cause) => {
          if (!controller.signal.aborted)
            setError(cause instanceof Error ? cause.message : t('Błąd porównania'));
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [a, b, operation, sequenceId]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    addEventListener('keydown', escape);
    return () => removeEventListener('keydown', escape);
  }, [close]);
  return (
    <section
      className="discovery-dialog panel"
      role="dialog"
      aria-label={t('Dodawanie i odejmowanie epok')}
    >
      <header>
        <b>{t('PORÓWNANIE EPOK')}</b>
        <button onClick={close} aria-label={t('Zamknij porównanie epok')}>
          ×
        </button>
      </header>
      <div className="epoch-selectors">
        {[
          ['A', a, setA],
          ['B', b, setB],
        ].map(([name, value, setter]) => (
          <label key={String(name)}>
            {t('Obraz ')}
            {String(name)}
            <select
              aria-label={t('Obraz epoki {0}', name)}
              value={value as string}
              onChange={(event) => (setter as typeof setA)(event.target.value)}
            >
              {frames.map((frame) => (
                <option key={frame.id} value={frame.observationId}>
                  {frame.detector?.replace('SPHEREx-', '')} · {frame.wavelengthUm.toFixed(4)} µm ·{' '}
                  {frame.observedAtUtc}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="discovery-toolbar">
        <button aria-pressed={operation === 'subtract'} onClick={() => setOperation('subtract')}>
          B − A
        </button>
        <button aria-pressed={operation === 'add'} onClick={() => setOperation('add')}>
          A + B
        </button>
        <button
          onClick={() => {
            setA(b);
            setB(a);
          }}
        >
          {t('Zamień A ↔ B')}
        </button>
        {result && (
          <a
            href={result.image}
            download={`spherex-epochs-${operation}.png`}
            onClick={(event) => {
              event.preventDefault();
              void downloadImage(result.image, `spherex-epochs-${operation}.png`).catch((cause) =>
                setError(cause.message),
              );
            }}
          >
            ↓ PNG
          </a>
        )}
      </div>
      {busy && <p role="status">{t('Obliczanie na źródłowych FITS…')}</p>}
      {error && <p role="alert">{t(error)}</p>}
      {result && (
        <>
          <img
            className="epoch-result"
            src={result.image}
            alt={operation === 'subtract' ? t('Różnica epok B minus A') : t('Suma epok A plus B')}
          />
          <p>
            {t('Pokrycie wspólne ')}
            {(result.coverage * 100).toFixed(1)}
            {t('% · zakres ')}
            {result.valueMin.toPrecision(5)}…{result.valueMax.toPrecision(5)} MJy/sr
          </p>
          {result.spectrallyDifferent && (
            <p className="amber">
              {t(
                'Uwaga: różne długości fali. Różnice mogą wynikać z widma obiektu, a nie ruchu lub zmiany jasności.',
              )}
            </p>
          )}
          {result.sources.map((source, index) => (
            <details key={source.observationId}>
              <summary>
                {index === 0 ? 'A' : 'B'} · {source.observedAtUtc} ·{' '}
                {source.wavelengthUm.toFixed(6)}
                {t(' µm · piksele wykluczone jakościowo ')}
                {(source.flaggedFraction * 100).toFixed(1)}%
              </summary>
              {source.qualityBits.map((flag) => (
                <p key={flag.bit}>
                  Bit {flag.bit} · {flag.name}: {flag.pixels}
                  {t(' pikseli (')}
                  {(flag.fraction * 100).toFixed(2)}%) · {flag.description}
                </p>
              ))}
            </details>
          ))}
        </>
      )}
      <p className="help">
        {t(
          'Wyrównanie WCS, wartości IMAGE − ZODI i flagi jakości. Różnica B−A: czerwony oznacza dodatnią zmianę, niebieski ujemną. Bez dopasowania PSF i lokalnego tła — artefakty i różne fale mogą imitować ruch. A+B jest sumą dwóch jasności powierzchniowych, nie średnią ani pomiarem o skalibrowanej poprawie S/N.',
        )}
      </p>
    </section>
  );
}
