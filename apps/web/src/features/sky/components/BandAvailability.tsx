import { t } from '../../../shared/i18n/index';
import { useEffect, useMemo, useRef } from 'react';
import type { FrameSource } from './FrameSources';
import { selectCompositeFrames, type RenderFrame, type SequenceBand } from '@spherex/contracts';

export function BandAvailability({
  allFrames,
  frames,
  bands,
  currentIndex,
  epochHours,
  onSelectFrame,
  onActivate,
  currentSources = [],
  exact = false,
  onSelectSource,
  selectedSourceId,
  onSelectEmpty,
  selectedEmpty,
}: {
  onSelectEmpty?: (frame: RenderFrame, detector: string) => void;
  selectedEmpty?: { time: string; detector: string } | null;
  currentSources?: FrameSource[];
  exact?: boolean;
  onSelectSource?: (id: string) => void;
  selectedSourceId?: string;
  allFrames: RenderFrame[];
  frames: RenderFrame[];
  bands: SequenceBand[];
  currentIndex: number;
  epochHours: number;
  onSelectFrame: (index: number) => void;
  onActivate: (ids: string[]) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const columns = useMemo(
    () =>
      frames.map((frame) => {
        const selected = exact
          ? allFrames.filter((source) => source.observedAtUtc === frame.observedAtUtc)
          : selectCompositeFrames(allFrames, frame.observedAtUtc, epochHours);
        return new Map(
          (selected.length ? selected : [frame]).map((source) => [source.detector, source]),
        );
      }),
    [allFrames, frames, epochHours, exact],
  );
  useEffect(() => {
    const container = scroller.current;
    const cell = container?.querySelector<HTMLElement>('[data-current="true"]');
    if (!container || !cell) return;
    const left = cell.offsetLeft,
      right = left + cell.offsetWidth;
    if (left < container.scrollLeft + 38) container.scrollLeft = left - 38;
    else if (right > container.scrollLeft + container.clientWidth)
      container.scrollLeft = right - container.clientWidth + 12;
  }, [currentIndex]);
  const date = (frame: RenderFrame) =>
    frame.observedAtUtc.replace('T', ' ').replace('Z', '') + ' UTC';
  return (
    <section
      className="band-availability"
      aria-label={exact ? t('Siatka ekspozycji FITS') : t('Dostępność zdjęć w klatkach animacji')}
    >
      <div className="availability-legend">
        <span>
          {exact
            ? t('EKSPOZYCJE · {0} czasów UTC', frames.length)
            : t(
                'KLATKI {0} · {1} · okres ≤ {2} godz.',
                frames[0]?.detector?.replace('SPHEREx-', ''),
                frames.length,
                epochHours,
              )}
        </span>
        <span>
          <i />
          {t(' zdjęcie ')}
          <i className="missing" />
          {t(' brak ')}
          <i className="current" />
          {t(' bieżąca ')}
          <b className="rgb-key key-r">R</b>
          <b className="rgb-key key-g">G</b>
          <b className="rgb-key key-b">B</b>
          {t(' użyte')}
        </span>
      </div>
      <div className="availability-scroll" ref={scroller}>
        <table>
          <thead>
            <tr>
              <th scope="col">{t('Pasmo')}</th>
              {frames.map((frame, index) => (
                <th
                  key={frame.id}
                  scope="col"
                  data-current={index === currentIndex}
                  title={t('Klatka {0}: {1}', index + 1, date(frame))}
                >
                  {index === 0 || index === currentIndex || (index + 1) % 10 === 0 ? index + 1 : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6].map((number) => {
              const detector = `SPHEREx-D${number}`;
              const band = bands.find((band) => band.detector === detector);
              const active = Boolean(frames.length && band?.frameIds.includes(frames[0]!.id));
              return (
                <tr key={detector}>
                  <th scope="row">
                    {exact ? (
                      <span>D{number}</span>
                    ) : (
                      <button
                        type="button"
                        aria-pressed={active}
                        disabled={band?.status !== 'ready'}
                        title={t('Oś czasu D{0} · {1} klatek', number, band?.frameIds.length ?? 0)}
                        onClick={() => band && onActivate(band.frameIds)}
                      >
                        D{number}
                      </button>
                    )}
                  </th>
                  {frames.map((frame, index) => {
                    const source = columns[index]!.get(detector);
                    const channels =
                      source && (exact || index === currentIndex)
                        ? (currentSources.find((item) => item.frame.id === source.id)?.channels ??
                          [])
                        : [];
                    const usage = channels.length
                      ? t(' Używane w kanałach {0} bieżącego RGB.', channels.join(' + '))
                      : '';
                    const description = t(
                      'D{0}, klatka {1}. {2}. Czas klatki: {3}.{4}',
                      number,
                      index + 1,
                      source
                        ? t('Zdjęcie: {0}, {1} µm', date(source), source.wavelengthUm.toFixed(3))
                        : exact
                          ? t('Brak ekspozycji o tym czasie')
                          : t('Brak zdjęcia w okresie {0} godz.', epochHours),
                      date(frame),
                      usage,
                    );
                    return (
                      <td key={frame.id} data-current={index === currentIndex}>
                        <button
                          type="button"
                          className={`availability-cell ${source ? 'available' : ''} ${channels.length ? 'rgb-used' : ''} ${(selectedSourceId && source?.id === selectedSourceId && !selectedEmpty) || (selectedEmpty?.time === frame.observedAtUtc && selectedEmpty.detector === detector) ? 'exposure-selected' : ''}`}
                          aria-label={description}
                          title={description}
                          aria-current={index === currentIndex ? 'step' : undefined}
                          onClick={() =>
                            exact
                              ? source
                                ? onSelectSource?.(source.id)
                                : onSelectEmpty?.(frame, detector)
                              : onSelectFrame(index)
                          }
                        >
                          {channels.length > 0 && (
                            <span className="cell-channels" aria-hidden="true">
                              {channels.map((channel) => (
                                <i
                                  key={channel}
                                  className={`cell-channel channel-${channel.toLowerCase()}`}
                                />
                              ))}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
