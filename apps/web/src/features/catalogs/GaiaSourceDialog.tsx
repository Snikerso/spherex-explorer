import { useModalDialog } from '../../shared/hooks/useModalDialog';
import { createPortal } from 'react-dom';
import { t } from '../../shared/i18n';
import { CatalogPanel } from './CatalogPanel';
import type { SkyController } from '../sky/hooks/useSkyWorkspace';
export function GaiaSourceDialog({ sky }: { sky: SkyController }) {
  const dialog = useModalDialog();
  return createPortal(
    <dialog
      className="source-comparison catalog-dialog"
      ref={dialog}
      onClose={() => sky.setGaiaSource(undefined)}
      aria-label="Gaia DR3"
    >
      <header>
        <h2>Gaia DR3</h2>
        <button autoFocus onClick={() => dialog.current?.close()}>
          {t('Zamknij ×')}
        </button>
      </header>
      <CatalogPanel
        gaia={sky.gaia}
        source={sky.gaiaSource}
        utc={sky.currentFrame?.observedAtUtc ?? ''}
        ready={Boolean(sky.currentFrame)}
        openWise={() => {
          sky.setGaiaSource(undefined);
          sky.setWiseOpen(true);
        }}
      />
    </dialog>,
    document.body,
  );
}
