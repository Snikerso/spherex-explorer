import { useEffect, useMemo, useRef, useState } from 'react';
import type { Observation } from '@spherex/contracts';
import { t } from '../../../shared/i18n';
import { observationGridColumns } from '../observation-timeline';

type Props = {
  observations: Observation[];
  epochHours: number;
  detectors: string[];
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
  onToggleColumn: (ids: string[], selected: boolean) => void;
  remaining: number;
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
  onToggleColumn,
  remaining,
  disabled,
  selectionFull = false,
}: Props) {
  const columns = useMemo(
    () => observationGridColumns(observations, epochHours),
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
          'Zdjęcia są pogrupowane według Time window: {0} godz. Górny kwadracik zaznacza całą pionową kolumnę.',
          epochHours,
        )}
      </p>
      <div className="selection-grid-scroll" ref={scroller} onScroll={measureScroll}>
        <table
          className="selection-time-table"
          aria-label={t('Dostępność ekspozycji przed przygotowaniem')}
        >
          <thead>
            <tr className="selection-window-row">
              <th>UTC</th>
              {[...new Set(columns.map((column) => column.groupIndex))].map((group) => {
                const items = columns.filter((column) => column.groupIndex === group);
                return (
                  <th
                    key={group}
                    colSpan={items.length}
                    scope="colgroup"
                    className="selection-window-heading"
                    title={`${date(items[0]!.utc)} – ${date(items.at(-1)!.endUtc)}`}
                  >
                    <div className="selection-window-label">
                      <strong>{t('Okno {0}', group + 1)}</strong>
                      <span>{t('Od {0}', date(items[0]!.utc).slice(0, 16))}</span>
                      <span>
                        {t(
                          'Do {0}',
                          date(
                            new Date(
                              Date.parse(items[0]!.utc) + epochHours * 3600000,
                            ).toISOString(),
                          ).slice(0, 16),
                        )}{' '}
                        UTC
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
            <tr>
              <th scope="col">UTC</th>
              {columns.map((column, index) => {
                const ids = detectors.flatMap((detector) =>
                  (column.bands.get(detector) ?? []).map((item) => item.id),
                );
                const selectedCount = ids.filter(isSelected).length;
                const full = ids.length > 0 && selectedCount === ids.length;
                const blocked = !full && ids.length - selectedCount > remaining;
                const caption = `${t('Kolumna {0}', index + 1)} · ${date(column.utc)} – ${date(column.endUtc)} · ${selectedCount}/${ids.length}`;
                return (
                  <th
                    scope="col"
                    key={column.key}
                    data-window-start={
                      index === 0 || columns[index - 1]!.groupIndex !== column.groupIndex
                    }
                  >
                    <button
                      className="selection-column-toggle"
                      type="button"
                      aria-label={caption}
                      title={
                        blocked
                          ? t(
                              'Ta kolumna przekracza limit 64 zdjęć. Najpierw odznacz inne zdjęcia.',
                            )
                          : caption
                      }
                      aria-pressed={full ? true : selectedCount ? 'mixed' : false}
                      disabled={disabled || !ids.length || blocked}
                      onClick={() => onToggleColumn(ids, !full)}
                    >
                      <span aria-hidden="true">{full ? '✓' : selectedCount ? '−' : ''}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {detectors.map((detector) => (
              <tr key={detector}>
                <th scope="row">{detector.replace('SPHEREx-', '')}</th>
                {columns.map((column, index) => {
                  const images = column.bands.get(detector) ?? [];
                  const missing = `${detector.replace('SPHEREx-', '')} · ${date(column.utc)} – ${date(column.endUtc)} · ${t('Brak ekspozycji')}`;
                  return (
                    <td
                      key={column.key}
                      data-window-start={
                        index === 0 || columns[index - 1]!.groupIndex !== column.groupIndex
                      }
                    >
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
