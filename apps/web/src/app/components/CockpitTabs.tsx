import { t } from '../../shared/i18n';
export type CockpitTab = 'nav' | 'sky' | 'tools' | 'history';
export function CockpitTabs({
  value,
  onChange,
}: {
  value: CockpitTab;
  onChange: (value: CockpitTab) => void;
}) {
  return (
    <nav className="mobile-tabs" aria-label={t('Panele kokpitu')}>
      {[
        ['nav', t('Nawigacja'), 'ORBITAL VIEW'],
        ['sky', t('Niebo'), 'SCIENCE IMAGERY'],
        ['tools', t('Instrumenty'), 'TELEMETRY'],
        ['history', t('Historia'), 'SEARCH HISTORY'],
      ].map(([id, label, caption], index) => (
        <button
          key={id}
          aria-label={label}
          aria-pressed={value === id}
          className={value === id ? 'active' : ''}
          onClick={() => onChange(id as CockpitTab)}
        >
          <span className="nav-step">0{index + 1}</span>
          <span>{label}</span>
          <small>{caption}</small>
        </button>
      ))}
    </nav>
  );
}
