import type { Observation } from '@spherex/contracts';
import { t } from '../../../shared/i18n';

type Props = {
  observations: Observation[];
  detectors: string[];
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
  disabled: boolean;
};

export function ObservationSelectionGrid({
  observations,
  detectors,
  isSelected,
  onToggle,
  disabled,
}: Props) {
  return (
    <div className="observation-selection-grid">
      <div className="selection-grid-legend">
        <span>
          <i className="selected" />
          {t('Wybrane')}
        </span>
        <span>
          <i />
          {t('Pominięte')}
        </span>
        <span>{t('Kliknij kwadrat, aby zmienić wybór. Od lewej: od najstarszych zdjęć.')}</span>
      </div>
      <div className="selection-grid-scroll">
        {detectors.map((detector) => (
          <div className="selection-grid-row" key={detector} role="group" aria-label={detector}>
            <b>{detector.replace('SPHEREx-', '')}</b>
            <div className="selection-grid-cells">
              {observations
                .filter((item) => item.detector === detector)
                .sort(
                  (a, b) =>
                    a.observedAtUtc.localeCompare(b.observedAtUtc) || a.id.localeCompare(b.id),
                )
                .map((item, index) => {
                  const caption = `${detector.replace('SPHEREx-', '')} · ${index + 1} · ${item.observedAtUtc.replace('T', ' ').replace('Z', ' UTC')} · ${item.sourceId ?? item.id}`;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={caption}
                      title={caption}
                      aria-pressed={isSelected(item.id)}
                      disabled={disabled}
                      onClick={() => onToggle(item.id)}
                    />
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
