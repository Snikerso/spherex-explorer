import { InstrumentTelemetry } from './InstrumentTelemetry';
import { InstrumentDataInfo } from './InstrumentDataInfo';
import { PointNotes } from './PointNotes';
import type { Observation, RenderFrame, ViewPatch } from '@spherex/contracts';
import { t } from '../../shared/i18n';
import type { ExplorerController } from '../explorer/useExplorer';
import type { SearchDraft } from '../navigation/search-form';
type Props = {
  explorer: ExplorerController;
  currentFrame?: RenderFrame;
  observation?: Observation;
  draft: SearchDraft;
  active: boolean;
  shareText: string;
  onCopyLink: (embed?: boolean) => Promise<void>;
  patch: (value: ViewPatch) => void;
};
export function InstrumentPanel({
  explorer,
  currentFrame,
  observation,
  draft,
  active,
  shareText,
  onCopyLink,
  patch,
}: Props) {
  const { view, sequence, annotations } = explorer;
  return (
    <aside className={`panel instruments ${active ? 'mobile-active' : ''}`}>
      <div className="panel-title instrument-header">
        <div>
          <span className="instrument-eyebrow">SPHEREx / DATA TOOLS</span>
          <h2>{t('INSTRUMENTY')}</h2>
        </div>
        <span className="instrument-release">{sequence?.input?.release.toUpperCase() ?? '—'}</span>
      </div>
      <section className="instrument-section">
        <h3>{t('TRYB PORÓWNANIA')}</h3>
        <div className="mode-switch" role="group" aria-label={t('TRYB PORÓWNANIA')}>
          {[
            ['single', t('Obraz')],
            ['blink', 'Blink'],
            ['side_by_side', 'A / B'],
          ].map(([mode, label]) => (
            <button
              key={mode}
              aria-pressed={view.mode === mode}
              className={view.mode === mode ? 'active' : ''}
              onClick={() => patch({ mode: mode as typeof view.mode, playing: false })}
            >
              {label}
            </button>
          ))}
        </div>
        <details className="instrument-guide">
          <summary>{t('Obsługa obrazu')}</summary>
          <p>
            {sequence
              ? t(
                  'Kliknij obraz, aby zaznaczyć punkt. Shift + przeciągnięcie przesuwa wspólny widok.',
                )
              : t('Porównanie wymaga przygotowanych klatek z różnych dat.')}
          </p>
        </details>
      </section>
      <InstrumentTelemetry currentFrame={currentFrame} observation={observation} />
      <section className="instrument-section instrument-links">
        <h3>{t('Dane i udostępnianie')}</h3>
        {currentFrame && (
          <a href={currentFrame.sourceUrl} target="_blank" rel="noreferrer">
            <span>{t('Produkt FITS')}</span>
            <span aria-hidden="true">↗</span>
          </a>
        )}
        <a
          href={`https://aladin.cds.unistra.fr/AladinLite/?${new URLSearchParams({ target: `${sequence?.input?.raDeg ?? draft.ra} ${sequence?.input?.decDeg ?? draft.dec}`, fov: String(sequence?.input?.fovDeg ?? draft.fov) })}`}
          target="_blank"
          rel="noreferrer"
        >
          <span>Aladin Lite</span>
          <span aria-hidden="true">↗</span>
        </a>
        <div className="instrument-share">
          <button
            title={t('Kopiuj kod iframe')}
            onClick={() => {
              void onCopyLink(true);
            }}
          >
            {t('Osadź')}
          </button>
          <button
            title={t('↗ Kopiuj link do współrzędnych')}
            onClick={() => {
              void onCopyLink();
            }}
          >
            {t('Kopiuj link')}
          </button>
        </div>
        {shareText && (
          <details className="share-preview" open>
            <summary>{t('Link lub kod do osadzenia')}</summary>
            <textarea
              aria-label={t('Link lub kod do osadzenia')}
              readOnly
              value={shareText}
              onFocus={(event) => event.currentTarget.select()}
            />
          </details>
        )}
      </section>
      <InstrumentDataInfo currentFrame={currentFrame} sequence={sequence} />
      <PointNotes explorer={explorer} patch={patch} />
      {annotations.length > 0 && (
        <details className="instrument-saved-notes">
          <summary>
            {t('Zapisane notatki')} <span>{annotations.length}</span>
          </summary>
          <div className="notes-list">
            {annotations.map((item) => (
              <p key={item.id}>
                {item.text}
                <small>
                  {item.raDeg.toFixed(5)}°, {item.decDeg.toFixed(5)}°
                </small>
              </p>
            ))}
          </div>
        </details>
      )}
    </aside>
  );
}
