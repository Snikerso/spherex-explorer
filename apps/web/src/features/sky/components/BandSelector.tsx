import { t } from '../../../shared/i18n/index';
import { useRef, type ReactNode } from 'react';
import type { Observation, SequenceBand } from '@spherex/contracts';

type Props = {
  availability?: ReactNode;
  observations: Observation[];
  detectors: string[];
  selectedIds: string[];
  result?: { requested: number; rendered: number; warnings: string[] };
  onSelectionChange: (ids: string[]) => void;
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
  observations,
  detectors,
  selectedIds,
  onSelectionChange,
  result,
  disabled,
  currentWavelength,
  preparedBands = [],
  activeFrameId,
  onChange,
  onPrepare,
  onActivate,
}: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  const photos = useRef<HTMLDetailsElement>(null);
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
  const selected = visible.filter((item) => selectedIds.includes(item.id));
  const valid =
    detectors.length > 0 &&
    detectors.every((detector) => {
      const items = selected.filter((item) => item.detector === detector);
      return items.length >= 2 && new Set(items.map((item) => item.observedAtUtc)).size >= 2;
    });
  return (
    <section className="band-selector band-multiple panel" aria-label={t('Wybór pasm')}>
      <span className="band-caption">{t('Pasma')}</span>
      <details className="band-multiselect" ref={menu}>
        <summary aria-label={t('Wybierz pasma')}>
          {detectors.length
            ? detectors.map((detector) => detector.replace('SPHEREx-', '')).join(', ')
            : t('Wybierz pasma')}
          <span aria-hidden="true">⌄</span>
        </summary>
        <fieldset disabled={disabled} className="band-options">
          <legend>{t('Wybierz jedno lub kilka pasm')}</legend>
          <div className="band-bulk">
            <button type="button" disabled={!available.length} onClick={() => onChange(available)}>
              {t('Wszystkie')}
            </button>
            <button type="button" disabled={!detectors.length} onClick={() => onChange([])}>
              {t('Wyczyść')}
            </button>
          </div>
          {bands.map((band) => (
            <label className="band-option" key={band.detector}>
              <input
                type="checkbox"
                aria-label={`Pasmo ${band.label}`}
                checked={detectors.includes(band.detector)}
                disabled={!band.usable}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...detectors, band.detector].sort()
                      : detectors.filter((item) => item !== band.detector),
                  )
                }
              />
              <span>
                <b>{band.label}</b>
                <small>{band.range}</small>
              </span>
              <span className="band-count">{band.count} obs.</span>
            </label>
          ))}
        </fieldset>
      </details>

      <button
        className="prepare-bands"
        disabled={disabled || !valid}
        onClick={() => {
          if (menu.current) menu.current.open = false;
          if (photos.current) photos.current.open = false;
          onPrepare();
        }}
      >
        {t('Przygotuj wszystko')}
      </button>
      <details className="band-photo-picker" ref={photos}>
        <summary>
          {t('Zdjęcia ')}
          {selected.length}/{visible.length}
        </summary>
        <fieldset disabled={disabled}>
          <div className="selection-actions">
            <button
              type="button"
              disabled={!visible.length}
              onClick={() => onSelectionChange(visible.map((item) => item.id))}
            >
              {t('Zaznacz wszystkie')}
            </button>
            <button type="button" onClick={() => onSelectionChange([])}>
              {t('Odznacz wszystkie')}
            </button>
          </div>
          <div className="observation-list">
            {visible.map((item) => (
              <label key={item.id} className="observation-row">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={(event) =>
                    onSelectionChange(
                      event.target.checked
                        ? [...new Set([...selectedIds, item.id])]
                        : selectedIds.filter((id) => id !== item.id),
                    )
                  }
                />
                <span>
                  {new Date(item.observedAtUtc).toLocaleString(t('pl-PL'), { timeZone: 'UTC' })}
                  <small>{item.detector?.replace('SPHEREx-', '')} · UTC</small>
                </span>
              </label>
            ))}
          </div>
          <p className="help">
            {!detectors.length
              ? t('Najpierw wybierz pasma.')
              : t('Wybierz co najmniej 2 zdjęcia z różnych czasów dla każdego pasma.')}
          </p>
        </fieldset>
      </details>
      {result && (
        <details className="sequence-result">
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
        </details>
      )}
      {preparedBands.length > 0 && (
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
