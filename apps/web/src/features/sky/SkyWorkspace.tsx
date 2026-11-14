import { PopupDetails } from '../../shared/components/PopupDetails';
import { useState } from 'react';
import { NeossatPanel } from '../catalogs/NeossatPanel';
import { t } from '../../shared/i18n';
import { GaiaSourceDialog } from '../catalogs/GaiaSourceDialog';
import { WiseComparison } from '../catalogs/WiseComparison';
import { BandSelector } from './components/BandSelector';
import { BandAvailability } from './components/BandAvailability';
import { RgbControls } from './components/RgbControls';
import { SkyViewport } from './components/SkyViewport';
import { SkyTimeline } from './components/SkyTimeline';
import type { SkyWorkspaceProps } from './types';
export function SkyWorkspace(props: SkyWorkspaceProps) {
  const { explorer, sky } = props;
  const [neossatOpen, setNeossatOpen] = useState(false);
  const { sequence, search } = explorer;
  const {
    colorActive,
    colorSources,
    allFrames,
    frames,
    displayFrameIndex,
    epochHours,
    selectFrame,
    patch,
    detectors,
    currentFrame,
    processing,
    setDetectors,
  } = sky;
  const catalogTools = (
    <>
      <label className="gaia-switch">
        <input
          type="checkbox"
          role="switch"
          aria-label={t('Nakładka Gaia DR3')}
          checked={sky.gaia.enabled}
          disabled={!sequence?.grid}
          onChange={(event) => sky.gaia.setEnabled(event.target.checked)}
        />
        <span className="gaia-switch-track" aria-hidden="true" />
        <span>
          Gaia <small>DR3</small>
        </span>
      </label>
      <PopupDetails className="catalog-menu">
        <summary>{t('Katalogi')}</summary>
        <div className="catalog-toolbar">
          {sky.gaia.enabled && (
            <span role="status">
              {sky.gaia.busy
                ? t('Wczytywanie katalogu…')
                : sky.gaia.error
                  ? t(sky.gaia.error)
                  : t('Źródła w zapytaniu: {0}', sky.gaia.data?.sources.length ?? 0)}
            </span>
          )}
          {sky.gaia.error && sky.gaia.enabled && (
            <button onClick={sky.gaia.retry}>{t('Spróbuj ponownie')}</button>
          )}
          {sky.gaia.data?.truncated && (
            <span>{t('Limit 300 najjaśniejszych źródeł. Katalog nie jest kompletny.')}</span>
          )}
          <button
            disabled={!currentFrame || !sequence?.grid}
            onClick={() => {
              patch({ playing: false });
              sky.setWiseOpen(true);
            }}
          >
            {t('Porównaj z WISE')}
          </button>
          <button
            disabled={!currentFrame}
            onClick={() => {
              patch({ playing: false });
              setNeossatOpen(true);
            }}
          >
            CADC / NEOSSat
          </button>
        </div>
      </PopupDetails>
    </>
  );
  return (
    <>
      {' '}
      <BandSelector
        onEpochHoursChange={sky.setEpochHours}
        epochHours={epochHours}
        key={search?.id ?? 'no-search'}
        availability={
          <BandAvailability
            currentSources={colorActive ? colorSources : []}
            allFrames={allFrames}
            frames={frames}
            bands={sequence?.bands ?? []}
            currentIndex={displayFrameIndex}
            epochHours={epochHours}
            onSelectFrame={selectFrame}
            onActivate={(frameIds) => patch({ frameIds, playing: false, selectedPoint: null })}
          />
        }
        observations={search?.observations ?? []}
        detectors={detectors}
        notice={
          search &&
          sequence?.input &&
          JSON.stringify(sequence.input) !== JSON.stringify(search.input)
            ? t('Nowy cel — przygotuj zdjęcia, aby zaktualizować podgląd.')
            : undefined
        }
        result={
          sequence?.status === 'ready'
            ? {
                requested: sequence.observationIds.length,
                rendered: sequence.frames?.length ?? 0,
                warnings: sequence.warnings ?? [],
              }
            : undefined
        }
        currentWavelength={currentFrame?.wavelengthUm}
        preparedBands={sequence?.bands}
        activeFrameId={currentFrame?.id}
        disabled={processing || explorer.preparing || explorer.busy || Boolean(explorer.runId)}
        onChange={setDetectors}
        onPrepare={(observationIds) => {
          void explorer.prepareBands(detectors, observationIds);
        }}
        onActivate={(frameIds) => patch({ frameIds, playing: false, selectedPoint: null })}
      />
      <RgbControls explorer={explorer} sky={sky} catalogs={catalogTools} />
      {neossatOpen && sequence?.input && currentFrame && (
        <NeossatPanel
          ra={sequence.input.raDeg}
          dec={sequence.input.decDeg}
          fov={sequence.input.fovDeg}
          utc={currentFrame.observedAtUtc}
          close={() => setNeossatOpen(false)}
        />
      )}
      {sky.gaiaSource && <GaiaSourceDialog sky={sky} />}
      {sky.wiseOpen && sequence?.input && currentFrame && (
        <WiseComparison
          input={sequence.input}
          close={() => sky.setWiseOpen(false)}
          snapshot={{
            source: currentFrame,
            frames: colorActive ? sky.colorFrames : [currentFrame],
            color: colorActive,
            channels: sky.rgbChannels,
            exposure: sky.exposure,
            sequenceId: sequence.id,
            size: sequence.grid?.width ?? 256,
          }}
        />
      )}
      <SkyViewport {...props} />
      <SkyTimeline explorer={explorer} sky={sky} />
    </>
  );
}
