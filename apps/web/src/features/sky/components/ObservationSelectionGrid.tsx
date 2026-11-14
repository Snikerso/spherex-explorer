import { useEffect, useMemo, useRef, useState } from 'react';
import type { Observation } from '@spherex/contracts';
import { t } from '../../../shared/i18n';
import { observationTimeline } from '../observation-timeline';

type Props = {
  observations: Observation[];
  epochHours: number;
  detectors: string[];
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
  disabled: boolean;
  selectionFull?: boolean;
};
const date = (utc: string) => utc.replace('T', ' ').replace('Z', ' UTC');
export function ObservationSelectionGrid({
  observations,
  epochHours,
  detectors,
  isSelected,
  onToggle,
  disabled,
  selectionFull = false,
}: Props) {
  const columns = useMemo(
    () => observationTimeline(observations, epochHours),
    [observations, epochHours],
  );
  const scroller = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: 0, max: 0 });
  const measureScroll = () => {
    const node = scroller.current;
    if (node)
      setScroll({ left: node.scrollLeft, max: Math.max(0, node.scrollWidth - node.clientWidth) });
  };
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const observer = new ResizeObserver(measureScroll);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    measureScroll();
    return () => observer.disconnect();
  }, [columns, detectors]);
  const move = (direction: number) => {
    const node = scroller.current;
    if (node) node.scrollBy({ left: direction * node.clientWidth * 0.75 });
  };
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
        <span>
          <i className="missing" />
          {t('Brak ekspozycji')}
        </span>
      </div>
      <p className="selection-grid-help">
        {t(
          'Wspólna oś UTC: kolumna obejmuje okres do {0} godz. zgodnie z Time window. Kliknij zdjęcie, aby zmienić wybór.',
          epochHours,
        )}
      </p>
      <div className="selection-grid-scroll" ref={scroller} onScroll={measureScroll}>
        <table
          className="selection-time-table"
          aria-label={t('Dostępność ekspozycji przed przygotowaniem')}
        >
          <thead>
            <tr>
              <th scope="col">UTC</th>
              {columns.map((column, index) => (
                <th
                  scope="col"
                  key={column.utc}
                  title={`${date(column.utc)} – ${date(column.endUtc)}`}
                  aria-label={`${date(column.utc)} – ${date(column.endUtc)}`}
                >
                  {index === 0 || index % 10 === 0 ? index + 1 : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detectors.map((detector) => (
              <tr key={detector}>
                <th scope="row">{detector.replace('SPHEREx-', '')}</th>
                {columns.map((column) => {
                  const images = column.bands.get(detector) ?? [];
                  const missing = `${detector.replace('SPHEREx-', '')} · ${date(column.utc)} – ${date(column.endUtc)} · ${t('Brak ekspozycji')}`;
                  return (
                    <td key={column.utc}>
                      <div className="selection-grid-cells">
                        {images.length ? (
                          images.map((item) => {
                            const caption = `${detector.replace('SPHEREx-', '')} · ${date(item.observedAtUtc)} · ${item.sourceId ?? item.id}`;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                aria-label={caption}
                                title={caption}
                                aria-pressed={isSelected(item.id)}
                                disabled={disabled || (selectionFull && !isSelected(item.id))}
                                onClick={() => onToggle(item.id)}
                              />
                            );
                          })
                        ) : (
                          <span
                            className="selection-missing-cell"
                            role="img"
                            aria-label={missing}
                            title={missing}
                          />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="selection-horizontal-scroll" aria-label={t('Przewijanie osi czasu')}>
        <button
          type="button"
          aria-label={t('Przewiń w lewo')}
          disabled={scroll.left <= 1}
          onClick={() => move(-1)}
        >
          ←
        </button>
        <input
          type="range"
          min="0"
          max={scroll.max}
          step="1"
          value={Math.min(scroll.left, scroll.max)}
          disabled={scroll.max <= 0}
          aria-label={t('Przewijaj siatkę w poziomie')}
          onChange={(event) => {
            if (scroller.current) scroller.current.scrollLeft = Number(event.target.value);
          }}
        />
        <button
          type="button"
          aria-label={t('Przewiń w prawo')}
          disabled={scroll.left >= scroll.max - 1}
          onClick={() => move(1)}
        >
          →
        </button>
      </div>
      {columns.length > 0 && (
        <div className="selection-time-range">
          <time>{date(columns[0]!.utc)}</time>
          <time>{date(columns.at(-1)!.endUtc)}</time>
        </div>
      )}
      <p className="selection-grid-help">
        {t(
          'To dostępność z katalogu. Pokrycie pola i użyteczność pikseli zostaną sprawdzone po odczycie FITS.',
        )}
      </p>
    </div>
  );
}
