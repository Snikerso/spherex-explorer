import { useModalDialog } from '../../shared/hooks/useModalDialog';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WiseReference, SearchInput } from '@spherex/contracts';
import { api } from '../../shared/api/client';
import { t } from '../../shared/i18n';
import { SkyImage } from '../sky/components/SkyImage';
import type { SourceComparisonSnapshot } from '../sky/components/SourceComparison';
const pending = new Map<string, Promise<WiseReference>>();
function loadWise(sequenceId: string, band: 'W1' | 'W2') {
  const key = `${sequenceId}/${band}`;
  let request = pending.get(key);
  if (!request) {
    request = api<WiseReference>('/catalogs/wise', { sequenceId, band }).finally(() =>
      pending.delete(key),
    );
    pending.set(key, request);
  }
  return request;
}
export function WiseComparison({
  snapshot: initialSnapshot,
  input: initialInput,
  close,
}: {
  snapshot: SourceComparisonSnapshot;
  input: SearchInput;
  close: () => void;
}) {
  const [snapshot] = useState(initialSnapshot);
  const [input] = useState(initialInput);
  const dialog = useModalDialog();
  const [band, setBand] = useState<'W1' | 'W2'>('W1');
  const [images, setImages] = useState<Partial<Record<'W1' | 'W2', WiseReference>>>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const result = images[band];
  useEffect(() => {
    if (result) return;
    let active = true;
    setBusy(true);
    setError('');
    loadWise(snapshot.sequenceId, band)
      .then((value) => {
        if (active) setImages((previous) => ({ ...previous, [band]: value }));
      })
      .catch((error) => {
        if (active) setError(error instanceof Error ? error.message : 'WISE unavailable');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [band, snapshot.sequenceId, result, retry]);
  const irsa = `https://irsa.ipac.caltech.edu/applications/wise/?${new URLSearchParams({ api: 'searchPos', ra: String(input.raDeg), dec: String(input.decDeg), imageset: 'allwise-multiband', intersect: 'OVERLAPS', imageband: '1,2', sr: `${input.fovDeg * 3600}s`, dataproductlevel: '3a' })}`;
  return createPortal(
    <dialog
      className="source-comparison archive-comparison"
      ref={dialog}
      onClose={close}
      aria-labelledby="wise-title"
    >
      <header>
        <div>
          <h2 id="wise-title">SPHEREx × WISE</h2>
          <p>{t('Wspólna siatka TAN · północ u góry · wschód po lewej')}</p>
        </div>
        <button autoFocus onClick={() => dialog.current?.close()}>
          {t('Zamknij ×')}
        </button>
      </header>
      <div className="archive-controls">
        <label>
          {t('Pasmo WISE')}{' '}
          <select
            value={band}
            disabled={busy}
            onChange={(event) => setBand(event.target.value as 'W1' | 'W2')}
          >
            <option value="W1">W1 · 3.4 µm</option>
            <option value="W2">W2 · 4.6 µm</option>
          </select>
        </label>
        <a href={irsa} target="_blank" rel="noreferrer">
          {t('Obrazy i epoki w IRSA')} ↗
        </a>
      </div>
      <div className="source-comparison-images">
        <figure>
          <figcaption>
            <b>SPHEREx</b>
            <span>
              {snapshot.source.observedAtUtc} · {snapshot.exposure.toFixed(1)} EV
            </span>
          </figcaption>
          <div className="source-comparison-image">
            <SkyImage
              sequenceId={snapshot.sequenceId}
              frames={snapshot.frames}
              size={snapshot.size}
              exposure={snapshot.exposure}
              color={snapshot.color}
              channels={snapshot.channels}
              label="SPHEREx"
            />
          </div>
        </figure>
        <figure>
          <figcaption>
            <b>AllWISE {band}</b>
            <span>
              {result?.timeStart && result.timeEnd
                ? `${result.timeStart} — ${result.timeEnd}`
                : t('Mozaika wielu ekspozycji · dokładny okres niedostępny')}
            </span>
          </figcaption>
          <div className="source-comparison-image">
            {result ? (
              <img src={result.image} alt={`AllWISE ${band}`} />
            ) : (
              <div className="archive-placeholder" role="status">
                {busy ? t('Pobieranie i wyrównywanie WISE…') : t(error)}
                {error && (
                  <button onClick={() => setRetry((value) => value + 1)}>
                    {t('Spróbuj ponownie')}
                  </button>
                )}
              </div>
            )}
          </div>
          {result && (
            <a href={result.sourceUrl} target="_blank" rel="noreferrer">
              {t('Źródłowy produkt AllWISE FITS')} ↗
            </a>
          )}
        </figure>
      </div>
      <p className="archive-caution">
        {t(
          'AllWISE to mozaika historycznych obserwacji, a nie pojedyncza klatka. Obrazy mają różne pasma, PSF i niezależny kontrast; porównanie jest wizualne, bez pomiaru zmian jasności i bez odejmowania między misjami.',
        )}
      </p>
      <small>WISE: UCLA / JPL–Caltech / NASA · IRSA / IPAC</small>
    </dialog>,
    document.body,
  );
}
