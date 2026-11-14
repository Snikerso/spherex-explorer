import { gaiaPosition, type GaiaSource } from '@spherex/contracts';
import { t } from '../../shared/i18n';
import type { GaiaController } from './useGaia';
export function CatalogPanel({
  gaia,
  source,
  utc,
  ready,
  openWise,
}: {
  gaia: GaiaController;
  source?: GaiaSource;
  utc: string;
  ready: boolean;
  openWise: () => void;
}) {
  const point = source ? gaiaPosition(source, utc) : null;
  return (
    <section className="instrument-section catalog-panel">
      <h3>{t('Katalogi i archiwa')}</h3>
      <label className="catalog-toggle">
        <input
          type="checkbox"
          checked={gaia.enabled}
          disabled={!ready}
          onChange={(event) => gaia.setEnabled(event.target.checked)}
        />{' '}
        {t('Nakładka Gaia DR3')}
      </label>
      {gaia.enabled && (
        <>
          <p role="status">
            {gaia.busy
              ? t('Wczytywanie katalogu…')
              : gaia.error
                ? t(gaia.error)
                : t('Źródła w zapytaniu: {0}', gaia.data?.sources.length ?? 0)}
          </p>
          {gaia.error && <button onClick={gaia.retry}>{t('Spróbuj ponownie')}</button>}
          {gaia.data?.truncated && (
            <p>{t('Limit 300 najjaśniejszych źródeł. Katalog nie jest kompletny.')}</p>
          )}
          <p className="help">
            {t(
              'Kliknij znacznik na obrazie. Pozycje uwzględniają ruch własny, bez paralaksy i prędkości radialnej. Brak wpisu nie oznacza nowego obiektu.',
            )}
          </p>
          {source && point && (
            <div className="catalog-object">
              <b>Gaia DR3 {source.id}</b>
              <dl>
                <dt>G</dt>
                <dd>{source.magnitude?.toFixed(3) ?? '—'} mag</dd>
                <dt>{t('Paralaksa')}</dt>
                <dd>{source.parallaxMas?.toFixed(3) ?? '—'} mas</dd>
                <dt>μα* / μδ</dt>
                <dd>
                  {source.pmra?.toFixed(2) ?? '—'} / {source.pmdec?.toFixed(2) ?? '—'} mas/yr
                </dd>
              </dl>
              <p>
                RA {point.raDeg.toFixed(7)}°<br />
                DEC {point.decDeg.toFixed(7)}°
              </p>
              <small>
                {point.propagated ? utc : `J${source.epoch}`} ·{' '}
                {point.propagated
                  ? t('Pozycja przybliżona na czas klatki')
                  : t('Brak pełnego ruchu własnego; pozycja katalogowa')}
              </small>
              <a
                href={`https://gea.esac.esa.int/archive/?target=Gaia%20DR3%20${source.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {t('Archiwum Gaia')} ↗
              </a>
            </div>
          )}
          <a
            href="https://gea.esac.esa.int/archive/documentation/GDR3/"
            target="_blank"
            rel="noreferrer"
          >
            ESA / Gaia DR3 ↗
          </a>
        </>
      )}
      <button disabled={!ready} onClick={openWise}>
        {t('Porównaj z WISE')} ↗
      </button>
    </section>
  );
}
