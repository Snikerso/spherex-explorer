import { HistoryPanel } from './features/history/HistoryPanel';
import { PopupDetails } from './shared/components/PopupDetails';
import { useRef, useState } from 'react';
import { t, useLanguage } from './shared/i18n';
import { useExplorer } from './features/explorer/useExplorer';
import { useSearchForm } from './features/navigation/useSearchForm';
import { useSkyWorkspace } from './features/sky/hooks/useSkyWorkspace';
import { SkyWorkspace } from './features/sky/SkyWorkspace';
import { ActivityStatus } from './app/components/ActivityStatus';
import { CockpitTabs, type CockpitTab } from './app/components/CockpitTabs';
import { CockpitFooter } from './app/components/CockpitFooter';
import { InstrumentPanel } from './features/instruments/InstrumentPanel';
import { SearchPanel } from './features/navigation/SearchPanel';
import { CopilotChat } from './features/copilot/CopilotChat';
import { MissionHeader } from './app/components/MissionHeader';
import { NavigationOrbit } from './features/navigation/NavigationOrbit';
import { EpochComparePanel } from './features/analysis/EpochComparePanel';
import { DiscoveryPanel } from './features/analysis/DiscoveryPanel';
export function App() {
  useLanguage();
  const explorer = useExplorer();
  const { view, targets, sequence, job } = explorer;
  const [tab, setTab] = useState<CockpitTab>('sky');
  const targetMenu = useRef<HTMLDetailsElement>(null);
  const sky = useSkyWorkspace(explorer, tab);
  const {
    draft,
    targetId,
    target,
    edit,
    choose,
    doSearch,
    send,
    copyLink,
    shareText,
    pendingForm,
    restoreForm,
  } = useSearchForm(explorer);
  const {
    currentFrame,
    observation,
    patch,
    allFrames,
    colorActive,
    colorSources,
    discovery,
    setDiscovery,
  } = sky;
  const loadedTarget = targets.find((item) => item.id === view.targetId);
  return (
    <main
      className="cockpit"
      data-embed={new URLSearchParams(location.search).get('embed') === '1'}
    >
      <MissionHeader connected={explorer.connected} />
      <ActivityStatus explorer={explorer} />
      <CockpitTabs
        value={tab}
        onChange={(value) => {
          if (value === 'history') setDiscovery(null);
          setTab(value);
        }}
      />
      <PopupDetails className="target-menu" ref={targetMenu}>
        <summary>
          <span>
            <b>1 · {t('Cel')}</b> {target?.name ?? t('Własne współrzędne')}
          </span>
          <span>
            RA {Number(draft.ra).toFixed(4)}° · DEC {Number(draft.dec).toFixed(4)}° · FOV{' '}
            {draft.fov}°
          </span>
          <strong>{t('Zmień cel')} ⌄</strong>
        </summary>
        <SearchPanel
          explorer={explorer}
          draft={draft}
          targetId={targetId}
          target={target}
          active
          pendingForm={Boolean(pendingForm)}
          choose={choose}
          edit={edit}
          doSearch={async () => {
            const valid = await doSearch();
            if (valid) {
              if (targetMenu.current) targetMenu.current.open = false;
              setTab('sky');
            }
          }}
        />
      </PopupDetails>
      {discovery === 'compare' && sequence && (
        <EpochComparePanel
          sequenceId={sequence.id}
          frames={allFrames}
          initialFrameId={currentFrame?.id}
          close={() => setDiscovery(null)}
        />
      )}
      {discovery && discovery !== 'compare' && sequence?.input && (
        <DiscoveryPanel
          key={`${sequence.id}/${discovery}`}
          sequenceId={sequence.id}
          point={
            view.selectedPoint ?? { raDeg: sequence.input.raDeg, decDeg: sequence.input.decDeg }
          }
          initialKind={discovery}
          close={() => setDiscovery(null)}
        />
      )}
      <div className="workspace" data-panel={tab}>
        <section className={`center ${tab === 'sky' || tab === 'history' ? 'mobile-active' : ''}`}>
          {tab === 'history' ? (
            <HistoryPanel
              currentId={view.searchId}
              disabled={
                !explorer.connected ||
                explorer.busy ||
                explorer.preparing ||
                Boolean(explorer.runId) ||
                job?.status === 'running' ||
                job?.status === 'queued'
              }
              onRestore={async (id) => {
                const state = await explorer.restoreSearch(id);
                if (state.searchInput) restoreForm(state.searchInput, state.targetId);
                setTab('sky');
              }}
            />
          ) : tab === 'nav' ? (
            <NavigationOrbit
              ra={draft.ra.trim() ? Number(draft.ra) : NaN}
              dec={draft.dec.trim() ? Number(draft.dec) : NaN}
              fov={Number(draft.fov)}
              targetName={target?.name ?? t('Wybrane współrzędne')}
              connected={explorer.connected}
              sequenceId={sequence?.id}
              frames={allFrames}
              currentFrameId={currentFrame?.id}
              rgbSources={colorActive ? colorSources : []}
            />
          ) : (
            <>
              <SkyWorkspace explorer={explorer} sky={sky} draft={draft} target={target} />
            </>
          )}
        </section>
        <InstrumentPanel
          explorer={explorer}
          currentFrame={currentFrame}
          observation={observation}
          draft={draft}
          active={tab === 'tools'}
          shareText={shareText}
          onCopyLink={copyLink}
          patch={patch}
        />
      </div>
      {job?.status === 'failed' && (
        <div className="job-status panel" role="alert">
          △ {t(job.error?.message ?? 'Nie udało się przygotować obrazów. Spróbuj ponownie.')}
        </div>
      )}
      <CopilotChat explorer={explorer} onSend={send} />
      <div className="operation" role="status" title={t(explorer.notice)}>
        <span className="dot" />
        {t(explorer.notice)}
      </div>
      <CockpitFooter target={loadedTarget ?? target} />
    </main>
  );
}
