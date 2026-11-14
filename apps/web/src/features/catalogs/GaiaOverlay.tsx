import { gaiaPosition, skyToPixel, type GaiaSource, type SkyGrid } from '@spherex/contracts';
import { t } from '../../shared/i18n';
export function GaiaOverlay({
  sources,
  grid,
  utc,
  select,
}: {
  sources: GaiaSource[];
  grid: SkyGrid;
  utc: string;
  select: (source: GaiaSource) => void;
}) {
  return (
    <div className="gaia-overlay" aria-label={t('Gwiazdy Gaia DR3')}>
      {sources.map((source) => {
        const position = gaiaPosition(source, utc),
          pixel = skyToPixel(grid, position);
        if (
          !pixel ||
          pixel.x < -0.5 ||
          pixel.y < -0.5 ||
          pixel.x >= grid.width - 0.5 ||
          pixel.y >= grid.height - 0.5
        )
          return null;
        return (
          <button
            key={source.id}
            className="gaia-marker"
            style={{
              left: `${((pixel.x + 0.5) / grid.width) * 100}%`,
              top: `${((pixel.y + 0.5) / grid.height) * 100}%`,
            }}
            aria-label={`Gaia DR3 ${source.id}`}
            title={`Gaia DR3 ${source.id} · G ${source.magnitude?.toFixed(2) ?? '—'} · ${position.propagated ? t('Ruch własny uwzględniony') : t('Pozycja katalogowa')}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              select(source);
            }}
          >
            {' '}
            <span />{' '}
          </button>
        );
      })}
    </div>
  );
}
