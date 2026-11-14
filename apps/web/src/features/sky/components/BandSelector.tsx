import { PopupDetails } from '../../../shared/components/PopupDetails';
import { t } from '../../../shared/i18n/index';
import type { ReactNode } from 'react';
import type { Observation, SequenceBand } from '@spherex/contracts';

type Props = {
  availability?: ReactNode;
  notice?: string;
  observations: Observation[];
  detectors: string[];
  result?: { requested: number; rendered: number; warnings: string[] };
  disabled: boolean;
  currentWavelength?: number;
  preparedBands?: SequenceBand[];
  activeFrameId?: string;
  onChange: (detectors: string[]) => void;
  onPrepare: () => void;
  onActivate: (frameIds: string[]) => void;
};

export function BandSelector({
  availability,
  notice,
  observations,
  detectors,
  result,
  disabled,
  currentWavelength,
  preparedBands = [],
  activeFrameId,
  onChange,
  onPrepare,
  onActivate,
}: Props) {
  const bands = [1, 2, 3, 4, 5, 6].map((number) => {
    const detector = `SPHEREx-D${number}`;
    const items = observations.filter((item) => item.detector === detector);
    const ranges = items
      .flatMap((item) => item.spectralRangeUm ?? [])
      .filter((value) => Number.isFinite(value) && value > 0);
    return {
      detector,
      label: `D${number}`,
      count: items.length,
      usable: new Set(items.map((item) => item.observedAtUtc)).size >= 2,
      range: ranges.length
        ? `${Math.min(...ranges).toFixed(2)}–${Math.max(...ranges).toFixed(2)} µm`
        : t('Brak danych'),
    };
  });
  const available = bands.filter((band) => band.usable).map((band) => band.detector);
  const visible = observations.filter((item) => detectors.includes(item.detector ?? ''));
  const selected = visible;
  const valid =
    detectors.length > 0 &&
    detectors.every((detector) => {
      const items = selected.filter((item) => item.detector === detector);
      return items.length >= 2 && new Set(items.map((item) => item.observedAtUtc)).size >= 2;
    });
  return (
    <section className="band-selector band-multiple panel" aria-label={t('Wybór pasm')}>
      <span className="band-caption">{t('2 · Pasma')}</span>
      <div className="band-chips" role="group" aria-label={t('Wybierz pasma')}>
        <button
          type="button"
          disabled={disabled || !available.length}
          aria-pressed={available.length > 0 && available.every((item) => detectors.includes(item))}
          onClick={() => {
            onChange(available);
          }}
        >
          {t('Wszystkie')}
        </button>
        {bands.map((band) => (
          <button
            type="button"
            key={band.detector}
            aria-pressed={detectors.includes(band.detector)}
            disabled={disabled || !band.usable}
            title={`${band.range} · ${band.count} ${t('zdjęć')}`}
            onClick={() => {
              onChange(
                detectors.includes(band.detector)
                  ? detectors.filter((item) => item !== band.detector)
                  : [...detectors, band.detector].sort(),
              );
            }}
          >
            <b>{band.label}</b>
            <small>{band.count}</small>
          </button>
        ))}
      </div>

      <button
        className="prepare-bands"
        disabled={disabled || !valid}
        onClick={() => {
          onPrepare();
        }}
      >
        {t('Przygotuj zdjęcia')} <span>({selected.length})</span>
      </button>
      {result && (
        <PopupDetails className="sequence-result">
          <summary title={t('Wynik ostatniego przygotowania i przyczyny pominięcia zdjęć')}>
            {t('Ostatni wynik: ')}
            {result.rendered}/{result.requested}
            {t(' klatek')}
          </summary>
          <div>
            {result.warnings
              .filter((note) => !note.includes('Maska '))
              .map((note) => (
                <p key={note}>{note}</p>
              ))}
          </div>
        </PopupDetails>
      )}
      {notice && <p className="flow-next">{notice}</p>}
      {preparedBands.length > 0 && (
        <section className="coverage-details" aria-label={t('Dostępność klatek')}>
          <div className="prepared-bands" role="group" aria-label={t('Gotowe pasma')}>
            {availability ??
              preparedBands.map((band) => (
                <button
                  key={band.detector}
                  className={activeFrameId && band.frameIds.includes(activeFrameId) ? 'active' : ''}
                  aria-pressed={Boolean(activeFrameId && band.frameIds.includes(activeFrameId))}
                  disabled={band.status !== 'ready'}
                  title={band.error?.message ?? t('{0} klatek', band.frameIds.length)}
                  onClick={() => onActivate(band.frameIds)}
                >
                  {band.detector.replace('SPHEREx-', '')}
                  {band.status === 'failed' ? t(' · brak zgodnej pary') : ''}
                </button>
              ))}
          </div>
        </section>
      )}
      <p
        className="band-hint"
        title={t('Każde pasmo ma własną sekwencję. Wybierz gotowe pasmo, aby je odtworzyć.')}
      >
        {!observations.length
          ? t('Najpierw wyszukaj obserwacje IRSA.')
          : `${currentWavelength ? `${currentWavelength.toFixed(3)} µm` : t('Osobna sekwencja dla każdego pasma')}`}
      </p>
    </section>
  );
}
