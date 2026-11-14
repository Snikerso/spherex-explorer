import { useState } from 'react';
import {
  compositeChannel,
  selectCompositeFrames,
  type RenderFrame,
  type RgbChannel,
} from '@spherex/contracts';
export function useComposite(allFrames: RenderFrame[], currentFrame?: RenderFrame) {
  const [exposure, setExposure] = useState(-1);
  const color = true;
  const [rgbChannels, setRgbChannels] = useState<RgbChannel[]>(
    [0, 1, 2].map(() => ({ enabled: true, detector: 'auto' })),
  );
  const [epochHours, setEpochHours] = useState(24);
  const colorFrames = currentFrame
    ? selectCompositeFrames(allFrames, currentFrame.observedAtUtc, epochHours)
    : [];
  const colorActive = color && colorFrames.length >= 2;
  const colorSources = colorFrames
    .map((frame, index) => ({
      frame,
      channels: rgbChannels.flatMap((channel, i) =>
        channel.enabled &&
        (channel.detector === frame.detector ||
          (channel.detector === 'auto' &&
            (compositeChannel(index, colorFrames.length) === i ||
              (colorFrames.length === 2 && i === 1))))
          ? [['R', 'G', 'B'][i]!]
          : [],
      ),
    }))
    .filter((source) => source.channels.length);
  const sourceTimes = colorSources.map((source) => Date.parse(source.frame.observedAtUtc));
  const sourceSpan = sourceTimes.length
    ? (Math.max(...sourceTimes) - Math.min(...sourceTimes)) / 3600000
    : 0;
  return {
    exposure,
    setExposure,
    color,
    rgbChannels,
    setRgbChannels,
    epochHours,
    setEpochHours,
    colorFrames,
    colorActive,
    colorSources,
    sourceSpan,
  };
}
export type CompositeController = ReturnType<typeof useComposite>;
