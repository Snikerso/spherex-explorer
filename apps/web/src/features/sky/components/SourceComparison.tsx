import { t } from '../../../shared/i18n/index';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RenderFrame, RgbChannel } from '@spherex/contracts';
import { SkyImage } from './SkyImage';

export type SourceComparisonSnapshot = {
  source: RenderFrame;
  frames: RenderFrame[];
  color: boolean;
  channels: RgbChannel[];
  exposure: number;
  sequenceId: string;
  size: number;
};

export function SourceComparison({
  snapshot,
  onClose,
}: {
  snapshot: SourceComparisonSnapshot;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const { source, frames, color, channels, exposure, sequenceId, size } = snapshot;
  return createPortal(
    <dialog
      className="source-comparison"
      ref={dialog}
      aria-labelledby="source-comparison-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
    >
      <header>
        <div>
          <h2 id="source-comparison-title">{t('Porównanie ze źródłem')}</h2>
          <p>
            {t('Zatrzymana klatka · wspólna siatka nieba · jasność ')}
            {exposure.toFixed(1)} EV
          </p>
        </div>
        <button
          autoFocus
          onClick={() => dialog.current?.close()}
          aria-label={t('Zamknij porównanie źródła')}
        >
          {t('Zamknij ×')}
        </button>
      </header>
      <div className="source-comparison-images">
        {[false, true].map((isSource) => (
          <figure key={String(isSource)}>
            <figcaption>
              <b>
                {isSource
                  ? t('Źródło {0}', source.detector?.replace('SPHEREx-', '') ?? 'FITS')
                  : color
                    ? t('Główny obraz RGB')
                    : t('Główny obraz')}
              </b>
              <span>
                {isSource
                  ? `${source.wavelengthUm.toFixed(3)} µm · ${source.observedAtUtc.replace('T', ' ').replace('Z', '')} UTC`
                  : t(
                      '{0} {1} · bieżące ustawienia kanałów',
                      frames.length,
                      frames.length === 1 ? t('zdjęcie') : t('zdjęcia'),
                    )}
              </span>
            </figcaption>
            <div className="source-comparison-image">
              <div style={{ transform: `scale(${zoom})` }}>
                <SkyImage
                  sequenceId={sequenceId}
                  frames={isSource ? [source] : frames}
                  size={size}
                  exposure={exposure}
                  color={!isSource && color}
                  channels={channels}
                  label={
                    isSource ? t('Powiększone zdjęcie źródłowe') : t('Główny obraz do porównania')
                  }
                />
              </div>
            </div>
          </figure>
        ))}
      </div>
      <footer>
        <label>
          {t('Wspólne powiększenie ')}
          <input
            type="range"
            aria-label={t('Powiększenie porównania')}
            min="1"
            max="4"
            step="0.1"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <output>{zoom.toFixed(1)}×</output>
        </label>
        <button onClick={() => setZoom(1)}>{t('Dopasuj')}</button>
        <a href={source.sourceUrl} target="_blank" rel="noreferrer">
          {t('Źródłowy FITS ↗')}
        </a>
      </footer>
    </dialog>,
    document.body,
  );
}
