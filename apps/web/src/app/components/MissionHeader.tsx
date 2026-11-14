import { t, useLanguage, setLanguage } from '../../shared/i18n/index';
import { useEffect, useState } from 'react';

function MissionPatch() {
  return (
    <svg className="mission-patch" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r="26" fill="#123d8d" />
      <circle cx="28" cy="28" r="25.5" fill="none" stroke="#648ac5" strokeWidth=".7" />
      <g fill="#fff" opacity=".85">
        <circle cx="15" cy="16" r=".8" />
        <circle cx="39" cy="14" r=".9" />
        <circle cx="44" cy="30" r=".7" />
        <circle cx="13" cy="36" r=".7" />
        <circle cx="33" cy="42" r=".7" />
        <path d="M31 10V15M28.5 12.5H33.5" stroke="#fff" strokeWidth=".7" />
      </g>
      <ellipse
        cx="28"
        cy="28"
        rx="24"
        ry="8"
        transform="rotate(-32 28 28)"
        fill="none"
        stroke="#d6e4ff"
        strokeWidth=".7"
        opacity=".7"
      />
      <path d="M7 43L48 10L33 32L36 25Z" fill="#f24b4d" />
      <text
        x="27.5"
        y="33"
        textAnchor="middle"
        fill="white"
        fontFamily="Arial,sans-serif"
        fontSize="16"
        fontWeight="900"
        letterSpacing="-.9"
      >
        SPX
      </text>
    </svg>
  );
}
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
          <small>INFRARED OBSERVATORY / MISSION OPERATIONS</small>
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
    </header>
  );
}
