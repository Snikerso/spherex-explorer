import { t } from '../../shared/i18n/index';
import { StackRgbComposer } from './StackRgbComposer';
import { useEffect, useState } from 'react';
import { api, downloadImage } from '../../shared/api/client';

type SpectrumPoint = {
  observationId: string;
  sourceUrl: string;
  detector: string;
  observedAtUtc: string;
  wavelengthUm: number;
  bandwidthUm: number;
  value: number;
  sigma: number;
};
type Analysis = {
  kind: 'spectrum' | 'stack';
  unit?: string;
  points?: SpectrumPoint[];
  stacks?: {
    detector: string;
    count: number;
    coverage: number;
    image: string;
    sources: { observationId: string; observedAtUtc: string; wavelengthUm: number }[];
  }[];
  skipped: { observationId: string; reason: string }[];
};
const colors = ['#7adade', '#7eaaff', '#c4a1ff', '#ffcc7e', '#ff9ed1', '#ff8f8f'];
export function DiscoveryPanel({
  sequenceId,
  point,
  initialKind,
  close,
}: {
  sequenceId: string;
  point: { raDeg: number; decDeg: number };
  initialKind: 'spectrum' | 'stack';
  close: () => void;
}) {
  const [kind, setKind] = useState(initialKind);
  const [range, setRange] = useState<[number, number]>([0.7, 5.1]);
  const [result, setResult] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!(range[0] >= 0.7 && range[1] <= 5.1 && range[0] < range[1])) {
      setResult(null);
      setBusy(false);
      setError(t('Wybierz zakres 0,7–5,1 µm, od mniejszej do większej wartości.'));
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    setError('');
    setResult(null);
    const timer = setTimeout(() => {
      api<Analysis>(
        `/sequences/${sequenceId}/analyze`,
        { kind, point, rangeUm: range },
        'POST',
        controller.signal,
      )
        .then(setResult)
        .catch((cause) => {
          if (!controller.signal.aborted)
            setError(cause instanceof Error ? cause.message : t('Błąd analizy'));
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [sequenceId, point.raDeg, point.decDeg, kind, range, revision]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    addEventListener('keydown', escape);
    return () => removeEventListener('keydown', escape);
  }, [close]);
  const points = result?.points ?? [];
  const xmin = points.length ? Math.min(...points.map((p) => p.wavelengthUm)) : range[0];
  const xmax = Math.max(xmin + 0.01, ...points.map((p) => p.wavelengthUm));
  const ymin = Math.min(0, ...points.map((p) => p.value - p.sigma));
  const ymax = Math.max(ymin + 1e-6, ...points.map((p) => p.value + p.sigma));
  const x = (value: number) => 60 + ((value - xmin) / (xmax - xmin)) * 510;
  const y = (value: number) => 185 - ((value - ymin) / (ymax - ymin)) * 155;
  function csv() {
    const columns: (keyof SpectrumPoint)[] = [
      'wavelengthUm',
      'value',
      'sigma',
      'bandwidthUm',
      'detector',
      'observedAtUtc',
      'observationId',
      'sourceUrl',
    ];
    const text = [
      columns.join(','),
      ...points.map((point) => columns.map((key) => JSON.stringify(point[key])).join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'spherex-pixel-spectrum-MJy-sr.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return (
    <section
      className="discovery-dialog panel"
      role="dialog"
      aria-label={t('Eksploracja widma i stacków')}
      aria-modal="false"
    >
      <header>
        <b>{t('LABORATORIUM SPHEREx')}</b>
        <button onClick={close} aria-label={t('Zamknij laboratorium')}>
          ×
        </button>
      </header>
      <div className="discovery-toolbar">
        <button aria-pressed={kind === 'spectrum'} onClick={() => setKind('spectrum')}>
          {t('Widmo punktu')}
        </button>
        <button aria-pressed={kind === 'stack'} onClick={() => setKind('stack')}>
          {t('Stacki D1–D6')}
        </button>
        <label>
          {t('λ od ')}
          <input
            aria-label={t('Minimalna długość fali analizy')}
            type="number"
            min=".7"
            max="5.1"
            step=".01"
            value={range[0]}
            onChange={(e) => setRange([Number(e.target.value), range[1]])}
          />
        </label>
        <label>
          {t('do ')}
          <input
            aria-label={t('Maksymalna długość fali analizy')}
            type="number"
            min=".7"
            max="5.1"
            step=".01"
            value={range[1]}
            onChange={(e) => setRange([range[0], Number(e.target.value)])}
          />{' '}
          µm
        </label>
        <button disabled={busy} onClick={() => setRevision((value) => value + 1)}>
          {t('Przelicz')}
        </button>
        {kind === 'spectrum' && (
          <button disabled={!points.length || busy} onClick={csv}>
            ↓ CSV
          </button>
        )}
      </div>
      <p>
        RA {point.raDeg.toFixed(7)}° · DEC {point.decDeg.toFixed(7)}
        {t('° · tylko dane przygotowane w tej sekwencji')}
      </p>
      {busy && <p role="status">{t('Analiza źródłowych FITS…')}</p>}
      {error && <p role="alert">{t(error)}</p>}
      {kind === 'spectrum' && result && (
        <>
          <p>
            {points.length}
            {t(' pomiarów · jasność powierzchniowa MJy/sr · λ w µm')}
          </p>
          {points.length ? (
            <svg
              viewBox="0 0 600 225"
              role="img"
              aria-label={t('Widmo: jasność powierzchniowa względem długości fali')}
            >
              <path d="M60 25V185H575" fill="none" stroke="#7794a1" />
              {[0, 1, 2, 3, 4].map((i) => (
                <g key={i}>
                  <text x={x(xmin + ((xmax - xmin) * i) / 4)} y="204" textAnchor="middle">
                    {(xmin + ((xmax - xmin) * i) / 4).toFixed(2)}
                  </text>
                  <text x="54" y={y(ymin + ((ymax - ymin) * i) / 4)} textAnchor="end">
                    {(ymin + ((ymax - ymin) * i) / 4).toPrecision(3)}
                  </text>
                </g>
              ))}
              <text x="300" y="220">
                λ [µm]
              </text>
              <text x="60" y="15">
                MJy/sr
              </text>
              {points.map((p) => (
                <g
                  key={p.observationId}
                  fill={colors[Number(p.detector.at(-1)) - 1]}
                  stroke={colors[Number(p.detector.at(-1)) - 1]}
                >
                  <title>
                    {p.detector} · {p.wavelengthUm.toFixed(6)} µm · {p.value.toPrecision(6)} ±{' '}
                    {p.sigma.toPrecision(3)} MJy/sr · {p.observedAtUtc} · {p.observationId}
                  </title>
                  <path
                    d={`M${x(p.wavelengthUm)} ${y(p.value - p.sigma)}V${y(p.value + p.sigma)}`}
                  />
                  <circle cx={x(p.wavelengthUm)} cy={y(p.value)} r="3" />
                </g>
              ))}
            </svg>
          ) : (
            <p>{t('Brak poprawnych pikseli w tym miejscu i zakresie.')}</p>
          )}
          <div className="spectrum-legend">
            {[...new Set(points.map((point) => point.detector))].sort().map((detector) => (
              <span key={detector} style={{ color: colors[Number(detector.at(-1)) - 1] }}>
                ● {detector.replace('SPHEREx-', '')} ·{' '}
                {points.filter((point) => point.detector === detector).length}
                {t(' pomiarów')}
              </span>
            ))}
          </div>
          <p className="help">
            {t(
              'Widmo poglądowe pojedynczego piksela: IMAGE − ZODI, z flagami jakości i błędami z VARIANCE. To nie jest fotometria aperturowa ani całkowity strumień źródła. Pomiary pochodzą z różnych dat; najedź na punkt, aby je odczytać. Dostępność pełnych 102 kanałów zależy od pokrycia obserwacjami.',
            )}
          </p>
          <details>
            <summary>{t('Pomiary, daty i źródła')}</summary>
            <div className="spectrum-table">
              <table>
                <thead>
                  <tr>
                    <th>{t('Pasmo')}</th>
                    <th>λ µm</th>
                    <th>MJy/sr ± σ</th>
                    <th>UTC</th>
                    <th>{t('Źródło')}</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.observationId}>
                      <td>{p.detector.replace('SPHEREx-', '')}</td>
                      <td>{p.wavelengthUm.toFixed(6)}</td>
                      <td>
                        {p.value.toPrecision(5)} ± {p.sigma.toPrecision(3)}
                      </td>
                      <td>{p.observedAtUtc}</td>
                      <td>
                        <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                          FITS ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      {kind === 'stack' && result && (
        <>
          <p className="help">
            {t(
              'Średnia ważona odwrotnością wariancji, osobno dla każdego detektora, po wyrównaniu WCS i zastosowaniu flag jakości. Zakres λ ogranicza piksele włączane do stacku. To poglądowe połączenie różnych fal i dat; interpolowana wariancja służy tylko jako względna waga, nie do deklarowania zmierzonego S/N.',
            )}
          </p>
          <StackRgbComposer stacks={result.stacks ?? []} />
          <div className="detector-stacks">
            {result.stacks?.map((stack) => (
              <article key={stack.detector}>
                <b>
                  {stack.detector} · {stack.count}
                  {t(' zdjęć')}
                </b>
                <img src={stack.image} alt={`Stack ${stack.detector}`} />
                <small>
                  {t('Pokrycie ')}
                  {(stack.coverage * 100).toFixed(1)}%
                </small>
                <a
                  href={stack.image}
                  download={`stack-${stack.detector}.png`}
                  onClick={(event) => {
                    event.preventDefault();
                    void downloadImage(stack.image, `stack-${stack.detector}.png`).catch((cause) =>
                      setError(cause.message),
                    );
                  }}
                >
                  ↓ PNG
                </a>
                <details>
                  <summary>{t('Daty i pomiary')}</summary>
                  {stack.sources.map((source) => (
                    <p key={source.observationId}>
                      {source.wavelengthUm.toFixed(4)} µm · {source.observedAtUtc}
                    </p>
                  ))}
                </details>
              </article>
            ))}
          </div>
          {!result.stacks?.length && <p>{t('Brak danych w wybranym zakresie.')}</p>}
        </>
      )}
      {result && result.skipped.length > 0 && (
        <details>
          <summary>
            {t('Pominięte pomiary: ')}
            {result.skipped.length}
          </summary>
          {result.skipped.map((item) => (
            <p key={item.observationId}>
              {item.observationId}: {item.reason}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
