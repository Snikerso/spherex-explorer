import { useEffect, useRef, useState } from 'react';
import type { SearchHistoryEntry, SearchHistoryPage } from '@spherex/contracts';
import { api } from '../../shared/api/client';
import { t } from '../../shared/i18n';
import { formatDate } from '../../shared/lib/date';
export function HistoryPanel({
  currentId,
  disabled,
  onRestore,
}: {
  currentId: string | null;
  disabled: boolean;
  onRestore: (id: string) => Promise<void>;
}) {
  const [entries, setEntries] = useState<SearchHistoryEntry[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [opening, setOpening] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  async function load(next?: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const page = await api<SearchHistoryPage>(
        `/search-history${next ? `?cursor=${encodeURIComponent(next)}` : ''}`,
        undefined,
        'GET',
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setEntries((previous) =>
          next
            ? [
                ...previous,
                ...page.entries.filter((entry) => !previous.some((old) => old.id === entry.id)),
              ]
            : page.entries,
        );
        setCursor(page.nextCursor);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : t('Nie udało się wczytać historii.'));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, []);
  async function restore(id: string) {
    setOpening(id);
    setError('');
    try {
      await onRestore(id);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : t('Nie udało się przywrócić wyszukiwania.'),
      );
    } finally {
      setOpening(null);
    }
  }
  return (
    <section className="search-history" aria-labelledby="history-title">
      <header>
        <div>
          <h2 id="history-title">{t('Historia wyszukiwań')}</h2>
          <p>{t('Wróć do poprzedniego pola i gotowych obrazów bez ponownego wyszukiwania.')}</p>
        </div>
        <button disabled={loading || Boolean(opening)} onClick={() => void load()}>
          {t('Odśwież')}
        </button>
      </header>
      <p className="history-scope">{t('Historia tej sesji · usuwana wraz z wygasłą sesją.')}</p>
      {disabled && (
        <p className="history-notice">
          {t('Zatrzymaj aktywne zadanie, aby przywrócić poprzednie wyszukiwanie.')}
        </p>
      )}
      {error && (
        <p role="alert" className="history-error">
          {t(error)}
        </p>
      )}
      {loading && !entries.length && <p role="status">{t('Wczytywanie historii…')}</p>}
      {!loading && !error && !entries.length && (
        <div className="history-empty">
          <h3>{t('Jeszcze nie ma wyszukiwań')}</h3>
          <p>{t('Wybierz cel i kliknij „Znajdź zdjęcia”. Wyniki pojawią się tutaj.')}</p>
        </div>
      )}
      <div className="history-list">
        {entries.map((entry) => (
          <article className="history-entry" key={entry.id}>
            <div className="history-entry-title">
              <h3>{entry.targetName ? t(entry.targetName) : t('Własne współrzędne')}</h3>
              <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)} UTC</time>
              {entry.id === currentId && <span className="history-current">{t('Bieżące')}</span>}
            </div>
            <div className="history-coordinates">
              RA {entry.input.raDeg.toFixed(6)}° · DEC {entry.input.decDeg.toFixed(6)}° · FOV{' '}
              {entry.input.fovDeg}° <span>{entry.input.release.toUpperCase()}</span>
            </div>
            <p className="history-dates">
              {entry.input.fromUtc || entry.input.toUtc
                ? `${entry.input.fromUtc?.slice(0, 10) ?? '…'} — ${entry.input.toUtc?.slice(0, 10) ?? '…'} UTC`
                : t('Wszystkie daty')}
            </p>
            <div className="history-entry-bottom">
              <span>
                {t('Zdjęcia: {0}', entry.count)}
                {entry.truncated ? ` / ${entry.total}` : ''}
              </span>
              <span className={entry.sequence?.status === 'ready' ? 'history-ready' : ''}>
                {entry.sequence?.status === 'ready'
                  ? t('Gotowe klatki: {0}', entry.sequence.frames)
                  : t('Bez gotowej sekwencji')}
              </span>
              <button
                disabled={disabled || Boolean(opening)}
                onClick={() => void restore(entry.id)}
              >
                {opening === entry.id
                  ? t('Przywracanie…')
                  : entry.sequence?.status === 'ready'
                    ? t('Otwórz obrazy')
                    : t('Przywróć wyszukiwanie')}
              </button>
            </div>
          </article>
        ))}
      </div>
      {cursor && (
        <button
          className="history-more"
          disabled={loading || Boolean(opening)}
          onClick={() => void load(cursor)}
        >
          {loading ? t('Wczytywanie historii…') : t('Pokaż starsze')}
        </button>
      )}
    </section>
  );
}
