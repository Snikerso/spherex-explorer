import type { RenderFrame } from './resources.js';

/** Closest useful epoch: maximize distinct detectors inside one bounded time window. */
export function selectCompositeFrames(frames: RenderFrame[], targetUtc: string, maxSpanHours: number): RenderFrame[] {
  const target = Date.parse(targetUtc);
  const span = maxSpanHours * 3600000;
  const ordered = frames.filter(frame => frame.detector && Number.isFinite(Date.parse(frame.observedAtUtc)) && Math.abs(Date.parse(frame.observedAtUtc) - target) <= span).sort((a, b) => Date.parse(a.observedAtUtc) - Date.parse(b.observedAtUtc));
  let best: RenderFrame[] = []; let score = Infinity;
  for (const anchor of ordered) {
    const start = Date.parse(anchor.observedAtUtc);
    const selected = new Map<string, RenderFrame>();
    for (const frame of ordered) {
      const time = Date.parse(frame.observedAtUtc);
      if (time < start || time > start + span) continue;
      const previous = selected.get(frame.detector!);
      if (!previous || Math.abs(time - target) < Math.abs(Date.parse(previous.observedAtUtc) - target)) selected.set(frame.detector!, frame);
    }
    const group = [...selected.values()];
    const distance = group.reduce((sum, frame) => sum + Math.abs(Date.parse(frame.observedAtUtc) - target), 0) / group.length;
    if (group.length > best.length || (group.length === best.length && distance < score)) { best = group; score = distance; }
  }
  return best.length >= 2 ? best.sort((a, b) => a.wavelengthUm - b.wavelengthUm) : [];
}

/** Shorter wavelengths are blue; middle green; longer red, using every selected detector. */
export function compositeChannel(index: number, count: number) { return count === 2 ? (index === 0 ? 2 : 0) : 2 - Math.min(2, Math.floor(index * 3 / count)); }

export type RgbChannel = { enabled: boolean; detector: string };
export function rgbValues(values: number[], detectors: string[], channels: RgbChannel[]): number[] | null {
  const sums = [0, 0, 0]; const counts = [0, 0, 0];
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    const channel = compositeChannel(index, values.length);
    sums[channel]! += value; counts[channel]!++;
  });
  const automatic = sums.map((sum, index) => counts[index] ? sum / counts[index]! : NaN);
  if (values.length === 2 && Number.isFinite(automatic[0]) && Number.isFinite(automatic[2])) automatic[1] = Math.sqrt(Math.max(0, automatic[0]!) * Math.max(0, automatic[2]!));
  const result = channels.map((channel, index) => !channel.enabled ? 0 : channel.detector === 'auto' ? automatic[index]! : values[detectors.indexOf(channel.detector)] ?? NaN);
  return result.every(Number.isFinite) && values.some(Number.isFinite) ? result : null;
}
