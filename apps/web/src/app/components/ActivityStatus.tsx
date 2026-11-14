import { t } from '../../shared/i18n';
import type { ExplorerController } from '../../features/explorer/useExplorer';
export function ActivityStatus({ explorer }: { explorer: ExplorerController }) {
  const { job } = explorer;
  const processing = job?.status === 'queued' || job?.status === 'running';
  const activityVisible =
    explorer.preparing || processing || explorer.busy || Boolean(explorer.runId);
  const activityLabel = explorer.busy
    ? t('Wyszukiwanie obserwacji w IRSA')
    : explorer.preparing
      ? t('Zlecanie przygotowania obrazów')
      : processing
        ? job?.status === 'queued'
          ? t('Obrazy oczekują w kolejce')
          : (job?.progress ?? 0) < 70
            ? t('Pobieranie FITS z IRSA')
            : t('Wyrównywanie i tworzenie obrazów')
        : t('Copilot pracuje');
  const activityProgress =
    processing && !explorer.busy && !explorer.preparing ? job?.progress : undefined;
  if (!activityVisible) return null;
  return (
    <section className="activity-status panel" aria-label={t('Postęp operacji')} aria-busy="true">
      <div className="activity-label" role="status">
        <span className="activity-spinner" aria-hidden="true" />
        <span>
          {activityLabel}
          {activityProgress !== undefined ? ` · ${activityProgress}%` : '…'}
        </span>
      </div>
      <progress
        aria-label={activityLabel}
        max="100"
        {...(activityProgress === undefined ? {} : { value: activityProgress })}
      />
      {explorer.busy ? (
        <button onClick={explorer.cancelSearch}>{t('Anuluj')}</button>
      ) : processing ? (
        <button
          onClick={() => {
            void explorer.cancelJob();
          }}
        >
          {t('Anuluj przygotowanie')}
        </button>
      ) : explorer.runId ? (
        <button
          onClick={() => {
            void explorer.cancelRun();
          }}
        >
          {t('Zatrzymaj copilota')}
        </button>
      ) : null}
    </section>
  );
}
