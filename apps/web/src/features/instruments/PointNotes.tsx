import { useState } from 'react';
import type { ViewPatch } from '@spherex/contracts';
import { t } from '../../shared/i18n';
import type { ExplorerController } from '../explorer/useExplorer';
export function PointNotes({
  explorer,
  patch,
}: {
  explorer: ExplorerController;
  patch: (value: ViewPatch) => void;
}) {
  const { view } = explorer;
  const [note, setNote] = useState('');
  return (
    <details className="instrument-selection" open={Boolean(view.selectedPoint)}>
      <summary>
        <span>{t('ZAZNACZONY PUNKT')}</span>
        <span className={view.selectedPoint ? 'point-active' : ''}>
          {view.selectedPoint ? '●' : '+'}
        </span>
      </summary>
      {view.selectedPoint ? (
        <>
          <p className="selection-readout">
            RA {view.selectedPoint.raDeg.toFixed(7)}°<br />
            DEC {view.selectedPoint.decDeg.toFixed(7)}°
          </p>
          <button className="clear-point" onClick={() => patch({ selectedPoint: null })}>
            {t('Wyczyść zaznaczenie')}
          </button>
        </>
      ) : (
        <p className="help">
          {t('Kliknij przygotowany obraz, aby odczytać RA/Dec i dodać notatkę.')}
        </p>
      )}
      <textarea
        aria-label={t('Notatka')}
        placeholder={t('Notatka do zaznaczenia…')}
        disabled={!view.selectedPoint}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={2000}
      />
      <button
        className="save-point"
        disabled={!view.selectedPoint || !note.trim()}
        onClick={() => {
          void explorer.saveNote(note.trim());
        }}
      >
        {t('Zapisz notatkę')}
      </button>
    </details>
  );
}
