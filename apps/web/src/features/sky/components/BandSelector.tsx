import { ObservationSelectionGrid } from './ObservationSelectionGrid';
import { PopupDetails } from '../../../shared/components/PopupDetails';
import { t } from '../../../shared/i18n/index';
import { useState, type ReactNode } from 'react';
import { sampleObservations } from '../observation-selection';
import { MAX_SELECTED_OBSERVATIONS, type Observation, type SequenceBand } from '@spherex/contracts';

type Props = {
  availability?: ReactNode;
  epochHours: number;
  onEpochHoursChange: (hours: number) => void;
  notice?: string;
  observations: Observation[];
  detectors: string[];
  result?: { requested: number; rendered: number; warnings: string[] };
  disabled: boolean;
  currentWavelength?: number;
  preparedBands?: SequenceBand[];
  activeFrameId?: string;
  onChange: (detectors: string[]) => void;
  onPrepare: (observationIds: string[]) => void;
  onActivate: (frameIds: string[]) => void;
};

export function BandSelector({
  availability,
  epochHours,
  onEpochHoursChange,
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
  const [imageBand, setImageBand] = useState<string | null>(null);
  const [percent, setPercent] = useState(100);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const visible = observations.filter((item) => detectors.includes(item.detector ?? ''));
  const sampled = new Set(sampleObservations(visible, percent, MAX_SELECTED_OBSERVATIONS));
  const isSelected = (id: string) => overrides[id] ?? sampled.has(id);
  const changePercent = (value: number) => {
    if (!Number.isFinite(value)) return;
    setPercent(Math.min(100, Math.max(1, Math.round(value))));
    setOverrides({});
  };
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
  const activeImageBand = imageBand && detectors.includes(imageBand) ? imageBand : null;
  const selected = visible.filter((item) => isSelected(item.id));
  const valid =
    selected.length <= MAX_SELECTED_OBSERVATIONS &&
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
            setOverrides({});
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
              setOverrides({});
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
          onPrepare(selected.map((item) => item.id));
        }}
      >
        {t('Przygotuj zdjęcia')} <span>({selected.length})</span>
      </button>
      <section className="image-sampling" aria-label={t('Wybór zdjęć')}>
        <div className="sampling-controls">
          <label className="sampling-time-window">
            {t('Okres ')}
            <select
              aria-label={t('Maksymalny odstęp zdjęć RGB')}
              value={epochHours}
              onChange={(event) => onEpochHoursChange(Number(event.target.value))}
            >
              {[1, 6, 24, 72, 168].map((hours) => (
                <option key={hours} value={hours}>
                  {hours < 24 ? t('{0} godz.', hours) : t('{0} dni', hours / 24)}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="image-percent">{t('Udział zdjęć')}</label>
          <input
            id="image-percent"
            type="range"
            min="1"
            max="100"
            value={percent}
            disabled={disabled}
            onChange={(event) => changePercent(Number(event.target.value))}
          />
          <input
            className="sampling-number"
            type="number"
            min="1"
            max="100"
            aria-label={t('Procent zdjęć')}
            value={percent}
            disabled={disabled}
            onChange={(event) => changePercent(Number(event.target.value))}
          />
          <span>%</span>
          <span>{t('Wybrano {0} z {1}', selected.length, visible.length)}</span>
          <button type="button" disabled={disabled} onClick={() => changePercent(100)}>
            {t('Wszystkie')}
          </button>
        </div>
        <small className="selection-limit">
          {t('Limit: maksymalnie 64 zdjęcia łącznie ze wszystkich pasm.')}
        </small>
        <small>
          {t(
            'Równomiernie w czasie, minimum 2 zdjęcia na pasmo. Zmiana procentu resetuje ręczne wybory.',
          )}
        </small>
        <details className="individual-images">
          <summary>
            {t('Edytuj pojedyncze zdjęcia')} · {selected.length}/{visible.length}
            {Object.keys(overrides).length ? ` · ${t('Wybór ręczny')}` : ''}
          </summary>
          <nav className="image-band-tabs" aria-label={t('Filtr zdjęć według pasma')}>
            <button
              type="button"
              aria-pressed={activeImageBand === null}
              onClick={() => setImageBand(null)}
            >
              {t('Wszystkie')}{' '}
              <small>
                {selected.length}/{visible.length}
              </small>
            </button>
            {bands
              .filter((band) => detectors.includes(band.detector))
              .map((band) => (
                <button
                  type="button"
                  key={band.detector}
                  aria-pressed={activeImageBand === band.detector}
                  onClick={() => setImageBand(band.detector)}
                >
                  {band.label}{' '}
                  <small>
                    {selected.filter((item) => item.detector === band.detector).length}/{band.count}
                  </small>
                </button>
              ))}
          </nav>
          <ObservationSelectionGrid
            epochHours={epochHours}
            observations={visible}
            detectors={
              activeImageBand
                ? [activeImageBand]
                : bands
                    .filter((band) => detectors.includes(band.detector))
                    .map((band) => band.detector)
            }
            isSelected={isSelected}
            disabled={disabled}
            selectionFull={selected.length >= MAX_SELECTED_OBSERVATIONS}
            onToggle={(id) => {
              if (!isSelected(id) && selected.length >= MAX_SELECTED_OBSERVATIONS) return;
              setOverrides((previous) => ({ ...previous, [id]: !isSelected(id) }));
            }}
          />
        </details>
        {!valid && visible.length > 0 && (
          <p role="status">
            {t('Wybierz co najmniej 2 zdjęcia z różnych czasów dla każdego zaznaczonego pasma.')}
          </p>
        )}
      </section>
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
