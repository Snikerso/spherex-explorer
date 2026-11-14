import { PopupDetails } from '../../../shared/components/PopupDetails';
import type { ReactNode } from 'react';
import { t } from '../../../shared/i18n';
import type { SkyWorkspaceProps } from '../types';
export function RgbControls({
  explorer,
  sky,
  catalogs,
}: Pick<SkyWorkspaceProps, 'explorer' | 'sky'> & { catalogs?: ReactNode }) {
  const { sequence } = explorer;
  const {
    allFrames,
    epochHours,
    exposure,
    setExposure,
    setDiscovery,
    rgbChannels,
    setRgbChannels,
    colorActive,
    colorFrames,
    color,
    currentFrame,
  } = sky;
  return (
    <section className="image-controls panel" aria-label={t('Kolor i jasność')}>
      <label className="exposure-control">
        {t('Jasność ')}
        <input
          aria-label={t('Jasność obrazu')}
          type="range"
          min="-6"
          max="2"
          step="0.1"
          value={exposure}
          onChange={(event) => setExposure(Number(event.target.value))}
        />
        <output>
          {exposure > 0 ? '+' : ''}
          {exposure.toFixed(1)} EV
        </output>
      </label>
      {catalogs}
      <PopupDetails className="analysis-menu">
        <summary>{t('Analizy')}</summary>
        <div>
          <button
            disabled={sequence?.status !== 'ready' || allFrames.length < 2}
            onClick={(event) => {
              setDiscovery('compare');
              event.currentTarget.closest('details')!.open = false;
            }}
          >
            {t('Porównaj A ± B')}
          </button>
          <button
            disabled={sequence?.status !== 'ready'}
            onClick={(event) => {
              setDiscovery('spectrum');
              event.currentTarget.closest('details')!.open = false;
            }}
          >
            {t('Widmo punktu')}
          </button>
          <button
            disabled={sequence?.status !== 'ready'}
            onClick={(event) => {
              setDiscovery('stack');
              event.currentTarget.closest('details')!.open = false;
            }}
          >
            {t('Stacki D1–D6')}
          </button>
        </div>
      </PopupDetails>
      <button onClick={() => setExposure(0)} title={t('Przywróć jasność początkową')}>
        Reset
      </button>
      <div className="rgb-channel-controls" role="group" aria-label={t('Kanały kolorów RGB')}>
        {['R', 'G', 'B'].map((name, index) => (
          <div className={`rgb-channel channel-${name.toLowerCase()}`} key={name}>
            <label>
              <input
                type="checkbox"
                aria-label={t('Włącz kanał {0}', name)}
                checked={rgbChannels[index]!.enabled}
                onChange={(event) =>
                  setRgbChannels((channels) =>
                    channels.map((channel, i) =>
                      i === index ? { ...channel, enabled: event.target.checked } : channel,
                    ),
                  )
                }
              />
              <b>{name}</b>
            </label>
            <select
              aria-label={t('Pasmo kanału {0}', name)}
              value={rgbChannels[index]!.enabled ? rgbChannels[index]!.detector : 'none'}
              onChange={(event) =>
                setRgbChannels((channels) =>
                  channels.map((channel, i) =>
                    i === index
                      ? {
                          ...channel,
                          enabled: event.target.value !== 'none',
                          detector:
                            event.target.value === 'none' ? channel.detector : event.target.value,
                        }
                      : channel,
                  ),
                )
              }
            >
              <option value="none">{t('Brak')}</option>
              <option value="auto">{t('Automatycznie')}</option>
              {[
                ...new Set(
                  allFrames
                    .map((frame) => frame.detector)
                    .filter((detector): detector is string => Boolean(detector)),
                ),
              ]
                .sort()
                .map((detector) => (
                  <option key={detector} value={detector}>
                    {detector.replace('SPHEREx-', '')}
                    {colorFrames.some((frame) => frame.detector === detector)
                      ? ''
                      : ` · ${t('Brak w okresie')}`}
                  </option>
                ))}
            </select>
          </div>
        ))}
      </div>
      {colorActive &&
        rgbChannels.some(
          (channel) =>
            channel.enabled &&
            channel.detector !== 'auto' &&
            !colorFrames.some((frame) => frame.detector === channel.detector),
        ) && (
          <small>
            {t('Wybrane pasmo nie ma zdjęcia w tym okresie. Zwiększ okres lub wybierz inne pasmo.')}
          </small>
        )}
      {color && !colorActive && (
        <small>
          {t('Brak 2 pasm w okresie ')}
          {epochHours}
          {t(' godz. Przygotuj więcej pasm lub zwiększ okres.')}
        </small>
      )}
      {currentFrame && !currentFrame.radianceName && (
        <small>{t('Przygotuj obrazy ponownie, aby odzyskać szczegóły jasnego centrum.')}</small>
      )}
    </section>
  );
}
