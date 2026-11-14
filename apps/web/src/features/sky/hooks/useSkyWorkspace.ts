import { useGaia } from '../../catalogs/useGaia';
import type { GaiaSource } from '@spherex/contracts';
import { useEffect, useState } from 'react';
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
  const gaia = useGaia(explorer.sequence?.grid);
  const [gaiaSource, setGaiaSource] = useState<GaiaSource>();
  const [wiseOpen, setWiseOpen] = useState(false);
  const [showSources, setShowSources] = useState(true);
  const [detectors, setDetectors] = useState<string[]>([]);
  useEffect(() => {
    const observations = explorer.search?.observations ?? [];
    setDetectors(
      [1, 2, 3, 4, 5, 6]
        .map((n) => `SPHEREx-D${n}`)
        .filter(
          (detector) =>
            new Set(
              observations
                .filter((item) => item.detector === detector)
                .map((item) => item.observedAtUtc),
            ).size >= 2,
        ),
    );
  }, [explorer.search?.id]);
  const observation = explorer.search?.observations.find(
    (item) => item.id === playback.currentFrame?.observationId,
  );
  const processing = explorer.job?.status === 'queued' || explorer.job?.status === 'running';
  return {
    gaia,
    gaiaSource,
    setGaiaSource,
    wiseOpen,
    setWiseOpen,
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
