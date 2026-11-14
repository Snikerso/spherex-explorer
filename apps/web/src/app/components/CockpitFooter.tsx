import type { Target } from '@spherex/contracts';
import { t } from '../../shared/i18n';
export function CockpitFooter({ target }: { target?: Target }) {
  return (
    <footer>
      <span>
        SPHEREx EXPLORER <b>/</b> NASA SPACE APPS PROJECT
      </span>
      <a
        href="https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html"
        target="_blank"
        rel="noreferrer"
      >
        {t('Dane NASA / JPL / Caltech · IRSA · DOI i atrybucja ↗')}
      </a>
      {target && (
        <a href={target!.sourceUrl} target="_blank" rel="noreferrer">
          {t('Współrzędne referencyjne: ')}
          {target!.epoch} ↗
        </a>
      )}
    </footer>
  );
}
