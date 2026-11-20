import { t, useLanguage, setLanguage } from '../../shared/i18n/index';
import { useEffect, useState } from 'react';

function MissionPatch() {
  return (
    <svg className="mission-patch" viewBox="0 0 56 56" aria-hidden="true">
      <rect x="3" y="3" width="50" height="50" rx="12" fill="#101c2c" stroke="#42536b" />
      <g strokeWidth="4" strokeLinecap="round">
        <path d="M13 34V23" stroke="#79c9ef" />
        <path d="M19 39V18" stroke="#7ca9ed" />
        <path d="M25 43V13" stroke="#a394e7" />
        <path d="M31 39V17" stroke="#d191c9" />
        <path d="M37 34V22" stroke="#e8a28c" />
        <path d="M43 29V26" stroke="#edc880" />
      </g>
    </svg>
  );
}
const astroStrategy = 'https://iceeye-explorer-9x76u.ondigitalocean.app';

export function MissionHeader({ connected }: { connected: boolean }) {
  const language = useLanguage();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <header className="topbar mission-topbar">
      <a className="brand" href="/" aria-label={t('SPHEREx Explorer — strona główna')}>
        <MissionPatch />
        <span className="brand-wordmark">
          SPHEREx <b>EXPLORER</b>
          <small>EXPLORE NASA SPHEREx OPEN DATA</small>
        </span>
      </a>
      <div className="mission">
        <span className="mission-label">SCIENCE OPERATIONS</span>
        <span className="mission-program">EARTH ORBIT / DEEP SKY</span>
      </div>
      <div className="mission-clock">
        <time dateTime={now.toISOString()}>
          {now.toISOString().slice(11, 19)}
          <small>UTC</small>
        </time>
        <span>{now.toISOString().slice(0, 10)}</span>
      </div>
      <span className={`connection ${connected ? 'online' : ''}`}>
        <i aria-hidden="true" />
        {connected ? 'SYSTEM ONLINE' : t('ŁĄCZENIE…')}
        <small>DATA SOURCE / IRSA</small>
      </span>
      <button
        type="button"
        className="language"
        aria-label={t(
          language === 'en'
            ? 'Język: angielski. Przełącz na polski.'
            : 'Język: polski. Przełącz na angielski.',
        )}
        onClick={() => setLanguage(language === 'en' ? 'pl' : 'en')}
      >
        {language.toUpperCase()}
      </button>
      <select
        className="mission-explorer-picker"
        aria-label={language === 'en' ? 'Choose explorer' : 'Wybierz eksplorator'}
        value="spherex"
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value !== 'spherex') {
            window.location.assign(value === 'iceeye' ? `${astroStrategy}/geoeye` : astroStrategy);
          }
        }}
      >
        <option value="astrostrategy">AstroStrategy</option>
        <option value="iceeye">IceEye Explorer</option>
        <option value="spherex">SPHEREx Explorer</option>
      </select>
    </header>
  );
}
