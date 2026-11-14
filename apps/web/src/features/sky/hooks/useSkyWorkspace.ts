import { useState } from 'react';
import type { ViewPatch } from '@spherex/contracts';
import type { ExplorerController } from '../../explorer/useExplorer';
import type { CockpitTab } from '../../../app/components/CockpitTabs';
import { usePlayback } from './usePlayback';
import { useComposite } from './useComposite';
import { useImageInteraction } from './useImageInteraction';
import { useFrameExports } from './useFrameExports';
export function useSkyWorkspace(explorer: ExplorerController, tab: CockpitTab) {
  const patch = (value: ViewPatch) => {
    void explorer.patch(value).catch(() => {});
  };
  const playback = usePlayback(explorer, tab, patch);
  const composite = useComposite(playback.allFrames, playback.currentFrame);
  const interaction = useImageInteraction(explorer, patch);
  const exports = useFrameExports(explorer, playback, composite, patch);
  const [discovery, setDiscovery] = useState<'spectrum' | 'stack' | 'compare' | null>(null);
  const [showSources, setShowSources] = useState(true);
  const [detectors, setDetectors] = useState<string[]>([]);
  const observation = explorer.search?.observations.find(
    (item) => item.id === playback.currentFrame?.observationId,
  );
  const processing = explorer.job?.status === 'queued' || explorer.job?.status === 'running';
  return {
    ...playback,
    ...composite,
    ...interaction,
    ...exports,
    discovery,
    setDiscovery,
    showSources,
    setShowSources,
    detectors,
    setDetectors,
    observation,
    patch,
    processing,
  };
}
export type SkyController = ReturnType<typeof useSkyWorkspace>;
