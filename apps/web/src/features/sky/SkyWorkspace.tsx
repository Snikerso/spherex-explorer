import { BandSelector } from './components/BandSelector';
import { BandAvailability } from './components/BandAvailability';
import { RgbControls } from './components/RgbControls';
import { SkyViewport } from './components/SkyViewport';
import { SkyTimeline } from './components/SkyTimeline';
import type { SkyWorkspaceProps } from './types';
export function SkyWorkspace(props: SkyWorkspaceProps) {
  const { explorer, sky } = props;
  const { view, sequence, search } = explorer;
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
  return (
    <>
      {' '}
      <BandSelector
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
        result={
          sequence?.status === 'ready'
            ? {
                requested: sequence.observationIds.length,
                rendered: sequence.frames?.length ?? 0,
                warnings: sequence.warnings ?? [],
              }
            : undefined
        }
        selectedIds={view.selectedObservationIds}
        onSelectionChange={(ids) => patch({ selectedObservationIds: ids })}
        currentWavelength={currentFrame?.wavelengthUm}
        preparedBands={sequence?.bands}
        activeFrameId={currentFrame?.id}
        disabled={processing || explorer.preparing || explorer.busy || Boolean(explorer.runId)}
        onChange={setDetectors}
        onPrepare={() => {
          void explorer.prepareBands(detectors);
        }}
        onActivate={(frameIds) => patch({ frameIds, playing: false, selectedPoint: null })}
      />
      <RgbControls explorer={explorer} sky={sky} />
      <SkyViewport {...props} />
      <SkyTimeline explorer={explorer} sky={sky} />
    </>
  );
}
