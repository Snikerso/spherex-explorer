import { pixelToSky, skyToPixel } from '@spherex/contracts';
import { t } from '../../../shared/i18n';
import { formatDate } from '../../../shared/lib/date';
import { SkyImage } from './SkyImage';
import type { SkyWorkspaceProps } from '../types';
export function FrameTile({
  index,
  label,
  explorer,
  sky,
}: { index: number; label?: string } & Pick<SkyWorkspaceProps, 'explorer' | 'sky'>) {
  const { sequence, view } = explorer;
  const { frames, beginPan, endPan, patch, exposure, selectPoint } = sky;
  const frame = frames[index % Math.max(1, frames.length)];
  if (!frame) return null;
  const marker =
    view.selectedPoint && sequence?.grid ? skyToPixel(sequence.grid, view.selectedPoint) : null;
  return (
    <div className="science-tile" key={label ?? 'single'}>
      <div className="frame-caption">
        {label && <b>{label} / </b>}
        {formatDate(frame.observedAtUtc)} UTC
      </div>
      <div className="image-clip" onPointerDown={beginPan} onPointerUp={endPan}>
        <div
          className="image-plane"
          role="button"
          tabIndex={0}
          aria-label={t('Zaznacz punkt na obrazie; Enter zaznacza środek')}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && sequence?.grid) {
              event.preventDefault();
              patch({
                selectedPoint: pixelToSky(
                  sequence.grid,
                  (sequence.grid.width - 1) / 2,
                  (sequence.grid.height - 1) / 2,
                ),
              });
            }
          }}
          style={{
            transform: `translate(${view.panX * 100}%, ${view.panY * 100}%) scale(${view.zoom})`,
          }}
          onClick={selectPoint}
        >
          <SkyImage
            sequenceId={sequence!.id}
            frames={[frame]}
            size={sequence!.grid?.width ?? 256}
            exposure={exposure}
            label={t('Obserwacja SPHEREx {0} UTC', formatDate(frame.observedAtUtc))}
          />
          {marker && (
            <span
              className="point-marker"
              style={{
                left: `${((marker.x + 0.5) / sequence!.grid!.width) * 100}%`,
                top: `${((marker.y + 0.5) / sequence!.grid!.height) * 100}%`,
              }}
            />
          )}
        </div>
      </div>
      <small>
        {frame.wavelengthUm.toFixed(3)}
        {t(' µm · pokrycie ')}
        {((frame.unmaskedCoverage ?? frame.coverage) * 100).toFixed(1)}%
      </small>
    </div>
  );
}
