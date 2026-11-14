import { t } from '../../shared/i18n';
import type { NavigationController } from './useNavigationOrbit';
export function OrbitControls({ controller }: { controller: NavigationController }) {
  const {
    model,
    resetTime,
    readingPosition,
    solarView,
    setSolarView,
    setRunning,
    running,
    setOffset,
    offset,
    zoom,
    setZoom,
  } = controller;
  return (
    <>
      <header className="orbit-heading">
        <div>
          <span className="eyebrow">{t('NAWIGACJA ORBITALNA')}</span>
          <h2>{t('Ziemia · Słońce · Księżyc · SPHEREx')}</h2>
        </div>
        <span className={model.real ? 'online' : 'amber'}>
          {model.recorded
            ? model.period === null
              ? t('POZYCJA Z FITS')
              : t(model.estimated ? 'FITS · PRZYBLIŻONA ORBITA' : 'FITS · MODEL ORBITY')
            : readingPosition
              ? t('ODCZYT POZYCJI FITS')
              : model.real
                ? 'TLE + SGP4'
                : t('SCHEMAT POGLĄDOWY')}
        </span>
      </header>
      <div className="orbit-controls">
        <button
          aria-pressed={solarView}
          title={t('Stały widok względem Słońca, północ u góry; kamera nie śledzi satelity')}
          onClick={() => setSolarView(true)}
        >
          {t('Widok względem Słońca')}
        </button>
        <button onClick={() => setRunning((value) => !value)}>
          {running ? t('Zatrzymaj czas') : t('Wznów czas')}
        </button>
        <button onClick={resetTime}>{t('Teraz')}</button>
        <label>
          {t('Czas ')}
          <input
            aria-label={t('Przesunięcie czasu orbity')}
            type="range"
            min="-120"
            max="120"
            step="1"
            value={offset}
            onChange={(event) => setOffset(Number(event.target.value))}
          />
          <output>
            {offset > 0 ? '+' : ''}
            {offset} min
          </output>
        </label>
        <label>
          Zoom{' '}
          <input
            aria-label={t('Powiększenie widoku Ziemi')}
            type="range"
            min=".7"
            max="1.3"
            step=".05"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
      </div>
    </>
  );
}
