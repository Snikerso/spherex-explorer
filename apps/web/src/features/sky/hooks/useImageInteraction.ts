import { useRef, type MouseEvent, type PointerEvent } from 'react';
import { pixelToSky, type ViewPatch } from '@spherex/contracts';
import type { ExplorerController } from '../../explorer/useExplorer';
export function useImageInteraction(
  explorer: ExplorerController,
  patch: (value: ViewPatch) => void,
) {
  const { view, sequence } = explorer;
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  function selectPoint(event: MouseEvent<HTMLDivElement>) {
    if (event.shiftKey || !sequence?.grid) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * sequence.grid.width - 0.5;
    const y = ((event.clientY - rect.top) / rect.height) * sequence.grid.height - 0.5;
    patch({ selectedPoint: pixelToSky(sequence.grid, x, y) });
  }
  function beginPan(event: PointerEvent<HTMLDivElement>) {
    if (event.shiftKey) {
      drag.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }
  function endPan(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    patch({
      panX: Math.max(-2, Math.min(2, view.panX + (event.clientX - drag.current.x) / rect.width)),
      panY: Math.max(-2, Math.min(2, view.panY + (event.clientY - drag.current.y) / rect.height)),
    });
    drag.current = null;
  }
  return { viewport, selectPoint, beginPan, endPan };
}
