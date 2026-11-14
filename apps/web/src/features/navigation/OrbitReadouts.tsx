import { t } from '../../shared/i18n';
import type { NavigationController } from './useNavigationOrbit';
export function OrbitReadouts({ controller }: { controller: NavigationController }) {
  const { targetName, valid, ra, dec, model, radians, hit, fov } = controller;
  return (
    <>
      <div className="orbit-readouts">
        <div>
          <span>{t('WYBRANY CEL')}</span>
          <b>{targetName}</b>
          <small>
            {valid
              ? `RA ${ra.toFixed(5)}° · DEC ${dec.toFixed(5)}°`
              : t('Podaj prawidłowe RA i Dec w nawigacji.')}
          </small>
        </div>
        <div>
          <span>
            {t('POZYCJA ')}
            {model.recorded ? t('Z FITS · EKSPOZYCJA') : model.real ? t('Z TLE') : t('POGLĄDOWA')}
          </span>
          <b>
            {model.geographic.height.toFixed(0)} km ·{' '}
            {model.speed === null ? '—' : model.speed.toFixed(2)} km/s
          </b>
          <small>
            {(model.geographic.latitude / radians).toFixed(2)}
            {t('° szer. · ')}
            {(model.geographic.longitude / radians).toFixed(2)}
            {t('° dł.')}
          </small>
        </div>
        <div className={valid && hit !== null ? 'amber' : ''}>
          <span>{t('LINIA WZROKU')}</span>
          <b>
            {!valid
              ? t('Brak współrzędnych')
              : hit === null
                ? t('Ziemia nie zasłania celu')
                : t('Cel zasłania Ziemia')}
          </b>
          <small>
            FOV {Number.isFinite(fov) ? fov : '—'}° ·{' '}
            {model.recorded
              ? model.period === null
                ? t('POZYCJA Z FITS')
                : t(model.estimated ? 'propagacja dwuciałowa z FITS' : 'środek ekspozycji FITS')
              : t('okres orbity ≈ {0} min', model.period!.toFixed(1))}
          </small>
        </div>
      </div>
    </>
  );
}
