import { useModalDialog } from '../../shared/hooks/useModalDialog';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../shared/api/client';
import { t } from '../../shared/i18n';
type Result = {
  truncated: boolean;
  observations: { id: string; from: string | null; to: string | null; dataLink: string }[];
};
export function NeossatPanel({
  ra,
  dec,
  fov,
  utc,
  close,
}: {
  ra: number;
  dec: number;
  fov: number;
  utc: string;
  close: () => void;
}) {
  const dialog = useModalDialog();
  const [period, setPeriod] = useState(true),
    [result, setResult] = useState<Result>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError('');
    setResult(undefined);
    const params = new URLSearchParams({
      ra: String(ra),
      dec: String(dec),
      radius: String(Math.min(0.5, fov / Math.sqrt(2))),
    });
    if (period && Number.isFinite(Date.parse(utc))) {
      params.set('from', new Date(Date.parse(utc) - 7 * 86400000).toISOString());
      params.set('to', new Date(Date.parse(utc) + 7 * 86400000).toISOString());
    }
    api<Result>(`/catalogs/neossat?${params}`, undefined, 'GET', controller.signal)
      .then(setResult)
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'CADC unavailable');
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [ra, dec, fov, utc, period, retry]);
  return createPortal(
    <dialog
      className="source-comparison catalog-dialog"
      ref={dialog}
      onClose={close}
      aria-label="CADC / NEOSSat"
    >
      <header>
        <h2>CADC / NEOSSat</h2>
        <button autoFocus onClick={() => dialog.current?.close()}>
          {t('Zamknij ×')}
        </button>
      </header>
      <div className="catalog-panel">
        <p>
          RA {ra.toFixed(6)}° · DEC {dec.toFixed(6)}° · r ≤{' '}
          {Math.min(0.5, fov / Math.sqrt(2)).toFixed(3)}°
        </p>
        <label className="catalog-toggle">
          <input
            type="checkbox"
            checked={period}
            onChange={(event) => setPeriod(event.target.checked)}
          />
          {t('W ciągu 7 dni od klatki')}
        </label>
        <p role="status">
          {busy
            ? t('Wyszukiwanie NEOSSat…')
            : error
              ? t(error)
              : t('Znalezione produkty: {0}', result?.observations.length ?? 0)}
        </p>
        {error && (
          <button onClick={() => setRetry((value) => value + 1)}>{t('Spróbuj ponownie')}</button>
        )}
        {!busy && !error && result?.observations.length === 0 && (
          <p>{t('Brak pokrycia w wybranym polu i okresie. Spróbuj wszystkich dat.')}</p>
        )}
        {result?.truncated && <p>{t('Pokazano 100 najnowszych produktów.')}</p>}
        <div className="archive-results">
          {result?.observations.map((item, i) => (
            <article key={`${item.id}/${i}`}>
              <b>{item.id}</b>
              <p>
                {item.from ?? '—'} — {item.to ?? '—'}
              </p>
              <a href={item.dataLink} target="_blank" rel="noreferrer">
                {t('Pliki i metadane CADC')} ↗
              </a>
            </article>
          ))}
        </div>
        <p className="help">
          {t(
            'To wyszukiwanie pokrycia archiwum, nie potwierdzenie tego samego obiektu. Dostęp do części plików może wymagać logowania CADC.',
          )}
        </p>
        <a
          href="https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/neossat/"
          target="_blank"
          rel="noreferrer"
        >
          CSA / CADC / NEOSSat ↗
        </a>
      </div>
    </dialog>,
    document.body,
  );
}
