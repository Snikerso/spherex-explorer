import { t } from '../../../shared/i18n';
import { formatDate } from '../../../shared/lib/date';
import type { SkyWorkspaceProps } from '../types';
export function SkyTimeline({ explorer, sky }: Pick<SkyWorkspaceProps, 'explorer' | 'sky'>) {
  const { view, sequence } = explorer;
  const {
    frames,
    displayFrameIndex,
    selectFrame,
    imagesReady,
    patch,
    currentFrame,
    savingPng,
    colorActive,
    exporting,
    color,
    pair,
    setPair,
    savePng,
    exportMp4,
  } = sky;
  return (
    <div
      className="timeline panel timeline-compact"
      role="group"
      aria-label={t('Oś czasu i odtwarzanie')}
    >
      <div className="timeline-bar">
        <div className="transport">
          <button
            disabled={!frames.length}
            aria-label={t('Poprzednia klatka')}
            onClick={() => selectFrame((displayFrameIndex - 1 + frames.length) % frames.length)}
          >
            |◁
          </button>
          <button
            disabled={frames.length < 2 || !imagesReady || view.mode === 'single'}
            aria-label={view.playing ? t('Pauza') : t('Odtwórz')}
            onClick={() => patch({ playing: !view.playing })}
          >
            {view.playing ? 'Ⅱ' : '▷'}
          </button>
          <button
            disabled={!frames.length}
            aria-label={t('Następna klatka')}
            onClick={() => selectFrame((displayFrameIndex + 1) % frames.length)}
          >
            ▷|
          </button>
        </div>
        <input
          className="frame-slider"
          aria-label={t('Bieżąca klatka')}
          aria-valuetext={
            currentFrame ? `${formatDate(currentFrame.observedAtUtc)} UTC` : t('Brak klatek')
          }
          title={t('Odstępy czasu między obserwacjami są nierówne; tempo odtwarzania jest stałe.')}
          type="range"
          min="0"
          max={Math.max(0, frames.length - 1)}
          value={displayFrameIndex}
          disabled={!frames.length}
          onChange={(e) => selectFrame(Number(e.target.value))}
        />
        <span className="frame-counter" title={t('Bieżąca klatka / wszystkie klatki')}>
          {frames.length ? displayFrameIndex + 1 : 0} / {frames.length}
        </span>
        <button
          className="export-video"
          disabled={savingPng || !colorActive}
          title={t('Pobierz aktualny kolorowy obraz z wybranymi kanałami i jasnością')}
          onClick={() => {
            void savePng();
          }}
        >
          {savingPng ? 'Zapis…' : '↓ RGB PNG'}
        </button>
        <button
          className="export-video"
          disabled={exporting || sequence?.status !== 'ready' || !frames.length}
          onClick={() => {
            void exportMp4();
          }}
        >
          {exporting ? t('Eksport…') : color ? '↓ RGB MP4' : '↓ MP4'}
        </button>
        <span className="frame-date">{formatDate(currentFrame?.observedAtUtc)} UTC</span>
        <select
          className="playback-speed"
          aria-label={t('Tempo odtwarzania')}
          title={t('Klatki na sekundę')}
          value={view.fps}
          onChange={(e) => patch({ fps: Number(e.target.value) })}
        >
          {[...new Set([0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, view.fps])]
            .sort((a, b) => a - b)
            .map((fps) => (
              <option value={fps} key={fps}>
                {fps}
                {t(' kl./s')}
              </option>
            ))}
        </select>
      </div>
      {view.mode === 'side_by_side' && frames.length > 1 && (
        <div className="comparison-select">
          {[0, 1].map((side) => (
            <label key={side}>
              {t('KLATKA ')}
              {side ? 'B' : 'A'}
              <select
                value={pair[side]}
                onChange={(e) =>
                  setPair((current) =>
                    current.map((value, index) =>
                      index === side ? Number(e.target.value) : value,
                    ),
                  )
                }
              >
                {frames.map((frame, index) => (
                  <option key={frame.id} value={index}>
                    {formatDate(frame.observedAtUtc)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
