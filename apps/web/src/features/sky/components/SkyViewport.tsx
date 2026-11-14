import { t } from '../../../shared/i18n';
import { FrameSources } from './FrameSources';
import { SkyImage } from './SkyImage';
import { FrameTile } from './FrameTile';
import type { SkyWorkspaceProps } from '../types';
export function SkyViewport({ explorer, sky, draft, target }: SkyWorkspaceProps) {
  const { view, sequence, search } = explorer;
  const {
    showSources,
    currentFrame,
    viewport,
    setShowSources,
    frames,
    colorActive,
    colorSources,
    sourceSpan,
    beginPan,
    endPan,
    selectPoint,
    colorFrames,
    exposure,
    rgbChannels,
    colorImage,
    pair,
    frameIndex,
    processing,
    patch,
  } = sky;
  const renderFrame = (index: number, label?: string) => (
    <FrameTile key={label ?? 'single'} index={index} label={label} explorer={explorer} sky={sky} />
  );
  return (
    <div
      className={`viewport ${showSources && currentFrame ? 'with-source-preview' : ''}`}
      ref={viewport}
    >
      <div className="viewport-top">
        <span>
          <i className="dot" /> OBSERVATION VIEWPORT
        </span>
        <span className={sequence ? 'online' : 'amber'}>
          {sequence ? 'IRSA / FITS → PNG' : t('BRAK DANYCH')}
          {currentFrame && (
            <button
              className="source-preview-toggle"
              aria-pressed={showSources}
              onClick={() => setShowSources((value) => !value)}
            >
              {t('Źródła')}
            </button>
          )}
        </span>
      </div>
      <div className="coordinate top-left">
        RA {sequence?.input?.raDeg ?? draft.ra}° · DEC {sequence?.input?.decDeg ?? draft.dec}°
      </div>
      <div className="orientation">N ↑ · E ←</div>
      {sequence?.status === 'ready' && frames.length ? (
        <div
          className={`science-grid ${!colorActive && view.mode === 'side_by_side' ? 'split' : ''}`}
        >
          {colorActive ? (
            <div className="science-tile">
              <div className="frame-caption">
                {t('RGB · źródła: ')}
                {colorSources.length}
                {t(' · podgląd źródeł · kolory umowne')}
              </div>
              <div className="image-clip" onPointerDown={beginPan} onPointerUp={endPan}>
                <div
                  className="image-plane"
                  onClick={selectPoint}
                  style={{
                    transform: `translate(${view.panX * 100}%, ${view.panY * 100}%) scale(${view.zoom})`,
                  }}
                >
                  <SkyImage
                    sequenceId={sequence.id}
                    frames={colorFrames}
                    size={sequence.grid?.width ?? 256}
                    exposure={exposure}
                    color
                    channels={rgbChannels}
                    downloadRef={colorImage}
                    label={t('Kolorowa kompozycja pasm SPHEREx')}
                  />
                </div>
              </div>
              <small>
                {colorSources
                  .map((source) => source.frame.detector?.replace('SPHEREx-', ''))
                  .join(' + ') || t('Kanały wyłączone')}
                {t(' · rzeczywisty odstęp ')}
                {sourceSpan.toFixed(2)}
                {t(' godz.')}
              </small>
            </div>
          ) : view.mode === 'side_by_side' ? (
            <>
              {renderFrame(pair[0]!, 'A')}
              {renderFrame(pair[1]!, 'B')}
            </>
          ) : (
            renderFrame(frameIndex)
          )}
        </div>
      ) : (
        <>
          <div className="reticle" aria-hidden="true" />
          <div className="empty-sky">
            <span className="eyebrow">{t('TWÓJ FRAGMENT WSZECHŚWIATA')}</span>
            <h2>{target?.name ?? t('Własny obszar')}</h2>
            <p>
              {processing
                ? t('Przygotowywanie rzeczywistych obrazów…')
                : t('Ekran gotowy na pierwszą obserwację.')}
            </p>
            <small>
              {processing
                ? t('Pobieranie FITS i wyrównanie obrazów.')
                : t('Wyszukaj i wybierz co najmniej dwie obserwacje.')}
            </small>
          </div>
        </>
      )}
      {showSources && currentFrame && sequence && (
        <FrameSources
          sequenceId={sequence.id}
          sources={
            colorActive
              ? colorSources
              : view.mode === 'side_by_side'
                ? pair
                    .flatMap((index, side) =>
                      frames[index % frames.length]
                        ? [{ frame: frames[index % frames.length]!, channels: [side ? 'B' : 'A'] }]
                        : [],
                    )
                    .filter(
                      (source, index, sources) =>
                        sources.findIndex((item) => item.frame.id === source.frame.id) === index,
                    )
                : [{ frame: currentFrame, channels: [] }]
          }
          observations={search?.observations ?? []}
          size={sequence.grid?.width ?? 256}
          exposure={exposure}
          mainFrames={colorActive ? colorFrames : [currentFrame]}
          color={colorActive}
          channels={rgbChannels}
          onCompare={() => patch({ playing: false })}
        />
      )}
      <div className="viewport-bottom">
        <span>
          FOV {sequence?.input?.fovDeg ?? draft.fov}° <b> / </b> {view.zoom.toFixed(1)}×
        </span>
        <div>
          <button
            aria-label={t('Zmniejsz')}
            onClick={() => patch({ zoom: Math.max(1, view.zoom - 0.5) })}
          >
            −
          </button>
          <button
            aria-label={t('Zwiększ')}
            onClick={() => patch({ zoom: Math.min(8, view.zoom + 0.5) })}
          >
            +
          </button>
          <button onClick={() => patch({ zoom: 1, panX: 0, panY: 0 })}>{t('Dopasuj')}</button>
          <button
            aria-label={t('Pełny ekran')}
            onClick={() => {
              viewport.current
                ?.requestFullscreen?.()
                .catch(() => explorer.setNotice(t('Pełny ekran jest niedostępny.')));
            }}
          >
            ⛶
          </button>
        </div>
      </div>
    </div>
  );
}
