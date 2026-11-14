import { useRef, useState } from 'react';
import type { ViewPatch } from '@spherex/contracts';
import { t } from '../../../shared/i18n';
import { downloadVideo } from '../../../shared/api/client';
import type { ExplorerController } from '../../explorer/useExplorer';
import type { SkyImageHandle } from '../components/SkyImage';
import type { PlaybackController } from './usePlayback';
import type { CompositeController } from './useComposite';
export function useFrameExports(
  explorer: ExplorerController,
  playback: PlaybackController,
  composite: CompositeController,
  patch: (value: ViewPatch) => void,
) {
  const { sequence, view } = explorer;
  const { frames, currentFrame } = playback;
  const { color, exposure, epochHours, rgbChannels } = composite;
  const colorImage = useRef<SkyImageHandle>(null);
  const [savingPng, setSavingPng] = useState(false);
  const [exporting, setExporting] = useState(false);
  async function savePng() {
    if (!colorImage.current || !sequence || !currentFrame) return;
    setSavingPng(true);
    patch({ playing: false });
    try {
      await colorImage.current.downloadPng(
        `spherex-rgb-${currentFrame.observedAtUtc.replace(/[:.]/g, '-')}.png`,
      );
      explorer.setNotice(
        t('Pobrano aktualny obraz RGB jako PNG z wybranymi kanałami i jasnością.'),
      );
    } catch (error) {
      explorer.setNotice(error instanceof Error ? error.message : t('Nie udało się pobrać PNG.'));
    } finally {
      setSavingPng(false);
    }
  }
  async function exportMp4() {
    if (!sequence) return;
    setExporting(true);
    try {
      await downloadVideo(
        sequence.id,
        frames.map((frame) => frame.id),
        view.fps,
        { color, exposure, epochHours, channels: rgbChannels },
      );
      explorer.setNotice(
        color
          ? t(
              'Pobrano kolorowe MP4 z ustawionymi kanałami i jasnością. Okresy bez kompletu wybranych pasm pominięto.',
            )
          : t('Pobrano MP4 z ustawioną jasnością.'),
      );
    } catch (error) {
      explorer.setNotice(
        error instanceof Error ? error.message : t('Eksport MP4 nie powiódł się.'),
      );
    } finally {
      setExporting(false);
    }
  }
  return { colorImage, savingPng, exporting, savePng, exportMp4 };
}
