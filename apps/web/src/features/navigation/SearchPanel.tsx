import { t } from '../../shared/i18n';
import type { Target } from '@spherex/contracts';
import type { ExplorerController } from '../explorer/useExplorer';
import type { SearchDraft } from './search-form';
type Props = {
  explorer: ExplorerController;
  draft: SearchDraft;
  targetId: string | null;
  target?: Target;
  active: boolean;
  pendingForm: boolean | null;
  choose: (id: string) => void;
  edit: (key: keyof SearchDraft, value: string) => void;
  doSearch: () => Promise<void>;
};
export function SearchPanel({
  explorer,
  draft,
  targetId,
  target,
  active,
  pendingForm,
  choose,
  edit,
  doSearch,
}: Props) {
  const { targets } = explorer;
  return (
    <aside className={`panel navigation ${active ? 'mobile-active' : ''}`}>
      <div className="panel-title">
        <h2>{t('NAWIGACJA')}</h2>
        <span>01</span>
      </div>
      <label>
        {t('OBIEKT REFERENCYJNY')}
        <select value={targetId ?? ''} onChange={(event) => choose(event.target.value)}>
          <option value="">{t('Własne współrzędne')}</option>
          {targets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <p className="target-type">
        {t(target?.description ?? 'Obszar wskazany współrzędnymi ICRS')}
      </p>
      <div className="field-pair">
        <label>
          {t('RA / STOPNIE')}
          <input
            type="number"
            step="any"
            min="0"
            max="359.99999999"
            value={draft.ra}
            onChange={(e) => edit('ra', e.target.value)}
          />
        </label>
        <label>
          {t('DEC / STOPNIE')}
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            value={draft.dec}
            onChange={(e) => edit('dec', e.target.value)}
          />
        </label>
      </div>
      <label>
        {t('POLE WIDZENIA / STOPNIE')}
        <input
          type="number"
          min="0.001"
          max="2"
          step="0.01"
          value={draft.fov}
          onChange={(e) => edit('fov', e.target.value)}
        />
      </label>
      <p className="help">
        {t(
          '0,001–2° · większe pole zwiększa transfer i czas przygotowania; podgląd zachowuje 256×256 pikseli.',
        )}
      </p>
      <div className="date-fields">
        <label>
          {t('OD / UTC')}
          <input type="date" value={draft.from} onChange={(e) => edit('from', e.target.value)} />
        </label>
        <label>
          {t('DO / UTC')}
          <input type="date" value={draft.to} onChange={(e) => edit('to', e.target.value)} />
        </label>
      </div>
      <label>
        {t('WYDANIE ARCHIWUM')}
        <select value={draft.release} onChange={(e) => edit('release', e.target.value)}>
          {explorer.releases?.releases
            .filter((release) => release.enabled)
            .map((release) => (
              <option key={release.id} value={release.id}>
                {release.label}
              </option>
            ))}
          {!explorer.releases?.releases.some(
            (release) => release.id === draft.release && release.enabled,
          ) && (
            <option value={draft.release} disabled>
              {draft.release.toUpperCase()}
              {t(' · nieaktywne')}
            </option>
          )}
        </select>
      </label>
      <button
        className="refresh-releases"
        onClick={() => {
          void explorer.refreshReleases();
        }}
      >
        {t('↻ Odśwież wydania')}
      </button>
      {pendingForm && <p className="amber help">{t('Zmieniony formularz — wyszukaj ponownie.')}</p>}
      <button
        className="primary"
        onClick={() => {
          void doSearch();
        }}
        disabled={explorer.busy || !explorer.connected}
      >
        ⌕ {explorer.busy ? 'Wyszukiwanie…' : t('Szukaj w IRSA')} <span>↗</span>
      </button>
      {explorer.busy && <button onClick={explorer.cancelSearch}>{t('Anuluj wyszukiwanie')}</button>}
    </aside>
  );
}
