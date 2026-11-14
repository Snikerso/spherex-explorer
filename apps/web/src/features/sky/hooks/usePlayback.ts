import { useEffect, useMemo, useState } from 'react';
import type { ViewPatch } from '@spherex/contracts';
import { t } from '../../../shared/i18n';
import type { ExplorerController } from '../../explorer/useExplorer';
import type { CockpitTab } from '../../../app/components/CockpitTabs';
export function usePlayback(
  explorer: ExplorerController,
  tab: CockpitTab,
  patch: (value: ViewPatch) => void,
) {
  const { view, sequence } = explorer;
  const [frameIndex, setFrameIndex] = useState(0);
  const [pair, setPair] = useState([0, 1]);
  const [imagesReady, setImagesReady] = useState(false);
  const allFrames = useMemo(() => sequence?.frames ?? [], [sequence?.frames]);
  const frameSelectionKey = view.frameIds.join(',');
  const frames = useMemo(
    () => allFrames.filter((item) => view.frameIds.includes(item.id)),
    [allFrames, frameSelectionKey],
  );
  const displayFrameIndex =
    (view.mode === 'side_by_side' ? pair[0]! : frameIndex) % Math.max(1, frames.length);
  const currentFrame = frames[displayFrameIndex];
  useEffect(() => {
    setFrameIndex(0);
    setPair([0, 1]);
  }, [sequence?.id, view.frameIds.join(',')]);
  useEffect(() => {
    if (!sequence?.frames?.length) {
      setImagesReady(false);
      return;
    }
    let active = true;
    setImagesReady(false);
    const images = sequence.frames
      .filter((frame) => view.frameIds.includes(frame.id))
      .map(
        (frame) =>
          new Promise<void>((accept, reject) => {
            const image = new Image();
            image.onload = () => accept();
            image.onerror = reject;
            image.src = `/api/v1/sequences/${sequence.id}/frames/${frame.id}?quality=off`;
          }),
      );
    void Promise.all(images)
      .then(() => {
        if (active) setImagesReady(true);
      })
      .catch(() => {
        if (active)
          explorer.setNotice(
            t(
              'Nie udało się załadować wszystkich klatek. Odśwież stronę lub przygotuj sekwencję ponownie.',
            ),
          );
      });
    return () => {
      active = false;
    };
  }, [sequence?.id, view.frameIds.join(',')]);
  useEffect(() => {
    if (tab === 'nav' || !view.playing || !imagesReady || frames.length < 2) return;
    const timer = setInterval(() => {
      if (view.mode === 'side_by_side')
        setPair((current) => current.map((index) => (index + 1) % frames.length));
      else setFrameIndex((index) => (index + 1) % frames.length);
    }, 1000 / view.fps);
    return () => clearInterval(timer);
  }, [tab, view.playing, view.fps, view.mode, frames.length, imagesReady]);
  function selectFrame(index: number) {
    if (view.mode === 'side_by_side') setPair((current) => [index, current[1]!]);
    else setFrameIndex(index);
    if (view.playing) patch({ playing: false });
  }
  return {
    frameIndex,
    pair,
    setPair,
    allFrames,
    frames,
    currentFrame,
    displayFrameIndex,
    imagesReady,
    selectFrame,
  };
}
export type PlaybackController = ReturnType<typeof usePlayback>;
