import { t } from '../../../shared/i18n/index';
import { useState } from 'react';
import { SourceComparison, type SourceComparisonSnapshot } from './SourceComparison';
import type { RenderFrame, Observation, RgbChannel } from '@spherex/contracts';
import { SkyImage } from './SkyImage';

export type FrameSource = { frame: RenderFrame; channels: string[] };

export function FrameSources({
  sequenceId,
  sources,
  observations,
  size,
  exposure,
  mainFrames,
  color,
  channels: mainChannels,
  onCompare,
}: {
  sequenceId: string;
  sources: FrameSource[];
  observations: Observation[];
  size: number;
  exposure: number;
  mainFrames: RenderFrame[];
  color: boolean;
  channels: RgbChannel[];
  onCompare: () => void;
}) {
  const [comparison, setComparison] = useState<SourceComparisonSnapshot | null>(null);
  return (
    <>
      <aside className="frame-sources" aria-label={t('Zdjęcia składowe bieżącego obrazu')}>
        <header>
          <b>{t('ŹRÓDŁA KLATKI')}</b>
          <span>
            {t('Zdjęcia: ')}
            {sources.length}
          </span>
        </header>
        <div className="frame-source-list">
          {sources.map(({ frame, channels }) => {
            const observation = observations.find((item) => item.id === frame.observationId);
            return (
              <article className="frame-source" key={frame.id}>
                <div className="frame-source-heading">
                  <b>{frame.detector?.replace('SPHEREx-', '') ?? 'FITS'}</b>
                  <span>
                    {channels.map((channel) => (
                      <em
                        key={channel}
                        className={`source-channel source-channel-${channel.toLowerCase()}`}
                      >
                        {channel}
                      </em>
                    ))}
                  </span>
                </div>
                <button
                  type="button"
                  className="frame-source-image"
                  aria-label={t(
                    'Powiększ i porównaj źródło {0}',
                    frame.detector?.replace('SPHEREx-', '') ?? 'FITS',
                  )}
                  title={t('Powiększ i porównaj z głównym obrazem')}
                  onClick={() => {
                    onCompare();
                    setComparison({
                      source: frame,
                      frames: [...mainFrames],
                      color,
                      channels: mainChannels.map((channel) => ({ ...channel })),
                      exposure,
                      sequenceId,
                      size,
                    });
                  }}
                >
                  <SkyImage
                    sequenceId={sequenceId}
                    frames={[frame]}
                    size={size}
                    exposure={exposure}
                    label={t(
                      'Źródło {0}: {1}, {2}',
                      channels.join(' + '),
                      frame.detector ?? 'FITS',
                      frame.observedAtUtc,
                    )}
                  />
                  <span className="source-enlarge-hint">{t('⤢ Porównaj')}</span>
                </button>
                <span>{frame.wavelengthUm.toFixed(3)} µm</span>
                <time dateTime={frame.observedAtUtc}>
                  {frame.observedAtUtc.replace('T', ' ').replace('Z', '')} UTC
                </time>
                <details>
                  <summary>{t('Produkt i FITS')}</summary>
                  <p>
                    {observation?.sourceId ?? frame.sourceUrl.split('/').pop()}
                    <br />
                    ID: {frame.observationId}
                  </p>
                  <a href={frame.sourceUrl} target="_blank" rel="noreferrer">
                    {t('Źródłowy FITS ↗')}
                  </a>
                </details>
              </article>
            );
          })}
        </div>
        {!sources.length && (
          <p className="help">{t('Brak włączonych źródeł. Włącz kanał R, G lub B.')}</p>
        )}
      </aside>
      {comparison && <SourceComparison snapshot={comparison} onClose={() => setComparison(null)} />}
    </>
  );
}
