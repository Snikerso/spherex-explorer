import { useNavigationOrbit, type NavigationOrbitProps } from './useNavigationOrbit';
import { OrbitControls } from './OrbitControls';
import { OrbitVisualization } from './OrbitVisualization';
import { OrbitReadouts } from './OrbitReadouts';
import { OrbitExplanation } from './OrbitExplanation';
import { RecordedPointing } from './RecordedPointing';
import { t } from '../../shared/i18n';
export function NavigationOrbit(props: NavigationOrbitProps) {
  const controller = useNavigationOrbit(props);
  const {
    exposureId,
    chooseExposure,
    acceptRecordedSpacecraft,
    sequenceId,
    frames,
    currentFrameId,
    rgbSources,
  } = controller;
  return (
    <section className="orbit-view panel" aria-label={t('Ziemia i kierunek obserwacji SPHEREx')}>
      <OrbitControls controller={controller} />
      <RecordedPointing
        selectedFrameId={exposureId}
        onSelectExposure={chooseExposure}
        onRecordedSpacecraft={acceptRecordedSpacecraft}
        sequenceId={sequenceId}
        frames={frames}
        currentFrameId={currentFrameId}
        rgbSources={rgbSources}
      />
      <OrbitVisualization controller={controller} />
      <OrbitReadouts controller={controller} />
      <OrbitExplanation controller={controller} />
    </section>
  );
}
