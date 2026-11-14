import { t } from '../../shared/i18n/index';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  initialView,
  viewStateSchema,
  type Annotation,
  type Job,
  type Message,
  type RunEvent,
  type SearchInput,
  type SearchResult,
  type Sequence,
  type Target,
  type ViewPatch,
  type ViewState,
} from '@spherex/contracts';
import { api, ApiError } from '../../shared/api/client';

type ReleaseCatalog = {
  defaultRelease: string;
  releases: { id: string; label: string; enabled: boolean }[];
};
type Capabilities = { agent: boolean; dataMode: 'live' | 'demo'; imaging: boolean };
type ActiveRun = { id: string; active: boolean };
export function useExplorer() {
  const [view, setView] = useState(initialView);
  const latest = useRef(view);
  const [releases, setReleases] = useState<ReleaseCatalog | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState('Łączenie z backendem…');
  const [busy, setBusy] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [tool, setTool] = useState('');
  const stream = useRef<EventSource | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const manualQueue = useRef<Promise<unknown>>(Promise.resolve());
  const accept = useCallback((state: ViewState) => {
    const checked = viewStateSchema.parse(state);
    if (
      checked.viewRevision >= latest.current.viewRevision &&
      JSON.stringify(checked) !== JSON.stringify(latest.current)
    ) {
      latest.current = checked;
      setView(checked);
    }
    return checked;
  }, []);
  const refresh = useCallback(async () => accept(await api<ViewState>('/view')), [accept]);
  const report = useCallback((error: unknown) => {
    setNotice(error instanceof Error ? error.message : 'Operacja nie powiodła się.');
  }, []);
  const patch = useCallback(
    (patch: ViewPatch) => {
      const operation = manualQueue.current
        .catch(() => {})
        .then(async () => {
          try {
            return accept(
              await api<ViewState>(
                '/view',
                { patch, expectedRevision: latest.current.viewRevision },
                'PATCH',
              ),
            );
          } catch (error) {
            if (error instanceof ApiError && error.code === 'VIEW_CONFLICT') await refresh();
            report(error);
            throw error;
          }
        });
      manualQueue.current = operation;
      return operation;
    },
    [accept, refresh, report],
  );
  useEffect(() => {
    let disposed = false;
    let connecting = false;
    let ready = false;
    async function connect() {
      if (connecting || ready) return;
      connecting = true;
      try {
        let state: ViewState;
        try {
          state = await api<ViewState>('/view');
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) throw error;
          await api('/sessions', {});
          state = await api<ViewState>('/view');
        }
        if (state.qualityMask)
          state = await api<ViewState>(
            '/view',
            { patch: { qualityMask: false }, expectedRevision: state.viewRevision },
            'PATCH',
          );
        const [catalog, caps, history, active, releaseList] = await Promise.all([
          api<Target[]>('/targets'),
          api<Capabilities>('/capabilities'),
          api<Message[]>('/messages'),
          api<ActiveRun | null>('/agent/runs/current'),
          api<ReleaseCatalog>('/data-releases'),
        ]);
        if (disposed) return;
        ready = true;
        accept(state);
        setTargets(catalog);
        setReleases(releaseList);
        setCapabilities(caps);
        setMessages(history);
        setRunId(active?.id ?? null);
        setConnected(true);
        setNotice('Połączono z API i MongoDB. Wybierz obiekt i wyszukaj obserwacje IRSA.');
      } catch (error) {
        if (!disposed) report(error);
      } finally {
        connecting = false;
      }
    }
    void connect();
    const retry = setInterval(() => {
      void connect();
    }, 5000);
    return () => {
      disposed = true;
      clearInterval(retry);
      searchAbort.current?.abort();
      stream.current?.close();
    };
  }, [accept, report]);
  useEffect(() => {
    if (!connected) return;
    let disposed = false;
    let pending = false;
    const timer = setInterval(() => {
      if (pending) return;
      pending = true;
      void api<ViewState>('/view')
        .then((state) => {
          if (!disposed) accept(state);
        })
        .catch(report)
        .finally(() => {
          pending = false;
        });
    }, 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [connected, accept, report]);
  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setSearch(null);
    const load = () => {
      if (view.searchId)
        void api<SearchResult>(`/observation-searches/${view.searchId}`)
          .then((result) => {
            if (active) setSearch(result);
          })
          .catch((error) => {
            if (active) {
              report(error);
              retry = setTimeout(load, 2000);
            }
          });
    };
    load();
    return () => {
      active = false;
      clearTimeout(retry);
    };
  }, [view.searchId, report]);
  useEffect(() => {
    let active = true;
    if (!view.sequenceId) {
      setSequence(null);
      setAnnotations([]);
      return;
    }
    void Promise.all([
      api<Sequence>(`/sequences/${view.sequenceId}`),
      api<Annotation[]>(`/sequences/${view.sequenceId}/annotations`),
    ])
      .then(([data, notes]) => {
        if (active) {
          setSequence(data);
          setAnnotations(notes);
        }
      })
      .catch(report);
    return () => {
      active = false;
    };
  }, [view.sequenceId, report]);
  useEffect(() => {
    if (!view.jobId) {
      setJob(null);
      return;
    }
    let active = true;
    let pending = false;
    const check = async () => {
      if (pending) return;
      pending = true;
      try {
        const item = await api<Job>(`/jobs/${view.jobId}`);
        if (!active) return;
        setJob(item);
        if (['ready', 'failed', 'cancelled'].includes(item.status)) {
          clearInterval(timer);
          await refresh();
          if (item.status === 'ready')
            setNotice(
              'Sekwencja gotowa. Obrazy pochodzą z FITS IRSA; możesz uruchomić odtwarzanie.',
            );
          else setNotice(item.error?.message ?? 'Anulowano przygotowanie.');
        }
      } catch (error) {
        if (active) report(error);
      } finally {
        pending = false;
      }
    };
    const timer = setInterval(() => {
      void check();
    }, 1000);
    void check();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [view.jobId, refresh, report]);
  useEffect(() => {
    if (!runId) return;
    const source = new EventSource(`/api/v1/agent/runs/${runId}/events`);
    stream.current = source;
    let lastSeq = 0;
    const receive = (raw: Event) => {
      const event = JSON.parse((raw as MessageEvent).data) as RunEvent;
      if (event.seq <= lastSeq) return;
      lastSeq = event.seq;
      const payload = event.payload;
      if (event.type === 'view.updated') accept(payload.state as ViewState);
      if (event.type === 'tool.started') setTool(String(payload.name));
      if (event.type === 'message.delta') {
        const id = String(payload.messageId);
        const delta = String(payload.delta);
        setMessages((current) => {
          const previous = current.find((item) => item.id === id);
          if (previous?.status) return current;
          return previous
            ? current.map((item) =>
                item.id === id ? { ...item, content: item.content + delta } : item,
              )
            : [...current, { id, role: 'assistant', content: delta, createdAt: event.timestamp }];
        });
      }
      if (['run.completed', 'run.failed', 'run.cancelled'].includes(event.type)) {
        source.close();
        setRunId(null);
        setTool('');
        void Promise.all([refresh(), api<Message[]>('/messages')])
          .then(([, items]) => setMessages(items))
          .catch(report);
        const sequenceId = latest.current.sequenceId;
        if (sequenceId)
          void api<Annotation[]>(`/sequences/${sequenceId}/annotations`)
            .then(setAnnotations)
            .catch(report);
        if (event.type !== 'run.completed') setNotice(String(payload.content));
      }
    };
    for (const type of [
      'run.started',
      'view.updated',
      'tool.started',
      'tool.completed',
      'message.delta',
      'run.completed',
      'run.failed',
      'run.cancelled',
    ])
      source.addEventListener(type, receive);
    source.onerror = () => {
      void api<ActiveRun | null>('/agent/runs/current')
        .then((active) => {
          if (!active) {
            source.close();
            setRunId(null);
            setTool('');
            void refresh().catch(report);
            void api<Message[]>('/messages').then(setMessages).catch(report);
          }
        })
        .catch(report);
    };
    return () => source.close();
  }, [runId, accept, refresh, report]);
  async function searchObservations(input: SearchInput, targetId: string | null) {
    await manualQueue.current.catch(() => {});
    const abort = new AbortController();
    searchAbort.current = abort;
    setBusy(true);
    setSearchError('');
    setNotice('Wyszukiwanie rzeczywistych obserwacji w IRSA…');
    try {
      const result = await api<SearchResult>(
        '/observation-searches',
        { input, targetId, expectedRevision: latest.current.viewRevision },
        'POST',
        abort.signal,
      );
      await refresh();
      setSearch(result);
      setNotice(
        t(
          'IRSA: {0} obserwacji{1}. Wybierz zdjęcia do przygotowania.',
          result.observations.length,
          result.truncated ? ` z ${result.total}` : '',
        ),
      );
      return true;
    } catch (error) {
      if (!abort.signal.aborted) {
        setSearchError(
          error instanceof Error
            ? error.message
            : t('Nie udało się wyszukać zdjęć. Poprzednie wyniki zostały zachowane.'),
        );
        report(error);
        await refresh().catch(() => {});
      }
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function restoreSearch(id: string) {
    setBusy(true);
    try {
      await manualQueue.current.catch(() => {});
      const state = accept(
        await api<ViewState>(`/search-history/${id}/restore`, {
          expectedRevision: latest.current.viewRevision,
        }),
      );
      setNotice(t('Przywrócono wyszukiwanie z historii.'));
      return state;
    } catch (error) {
      report(error);
      await refresh().catch(() => {});
      throw error;
    } finally {
      setBusy(false);
    }
  }
  async function prepare() {
    setPreparing(true);
    await manualQueue.current.catch(() => {});
    try {
      const queued = await api<Sequence>('/sequences', {
        searchId: latest.current.searchId,
        observationIds: latest.current.selectedObservationIds,
        expectedRevision: latest.current.viewRevision,
      });
      setJob({
        id: queued.jobId,
        sequenceId: queued.id,
        status: queued.status,
        progress: 0,
        createdAt: new Date().toISOString(),
      });
      await refresh();
      setNotice(
        'Przygotowanie sekwencji w kolejce. Pobieranie wycinków FITS może potrwać kilka minut.',
      );
    } catch (error) {
      report(error);
      await refresh().catch(() => {});
    } finally {
      setPreparing(false);
    }
  }
  async function prepareBands(detectors: string[], observationIds?: string[]) {
    setPreparing(true);
    await manualQueue.current.catch(() => {});
    try {
      const queued = await api<Sequence>('/band-sequences', {
        searchId: latest.current.searchId,
        detectors,
        observationIds:
          observationIds ??
          search?.observations
            .filter((item) => detectors.includes(item.detector ?? ''))
            .map((item) => item.id),
        expectedRevision: latest.current.viewRevision,
      });
      setJob({
        id: queued.jobId,
        sequenceId: queued.id,
        status: queued.status,
        progress: 0,
        createdAt: new Date().toISOString(),
      });
      await refresh();
      setNotice(
        t('Przygotowywanie {0} pasm. Każde pasmo ma własną sekwencję czasową.', detectors.length),
      );
    } catch (error) {
      report(error);
      await refresh().catch(() => {});
    } finally {
      setPreparing(false);
    }
  }
  async function send(message: string) {
    await manualQueue.current.catch(() => {});
    try {
      const item = await api<ActiveRun>('/agent/runs', {
        message,
        clientRequestId: crypto.randomUUID(),
      });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: message,
          createdAt: new Date().toISOString(),
        },
      ]);
      setRunId(item.id);
    } catch (error) {
      report(error);
    }
  }
  async function saveNote(text: string) {
    if (!latest.current.selectedPoint || !latest.current.sequenceId) return;
    try {
      await api('/annotations', {
        ...latest.current.selectedPoint,
        sequenceId: latest.current.sequenceId,
        text,
        expectedRevision: latest.current.viewRevision,
      });
      setAnnotations(
        await api<Annotation[]>(`/sequences/${latest.current.sequenceId}/annotations`),
      );
      setNotice('Zapisano notatkę w sesji.');
    } catch (error) {
      report(error);
    }
  }
  return {
    view,
    releases,
    refreshReleases: async () => {
      try {
        setReleases(await api<ReleaseCatalog>('/data-releases'));
        setNotice('Odświeżono listę wydań danych.');
      } catch (error) {
        report(error);
      }
    },
    targets,
    search,
    sequence,
    job,
    annotations,
    messages,
    capabilities,
    connected,
    notice,
    busy,
    preparing,
    runId,
    tool,
    setNotice,
    patch,
    searchObservations,
    prepare,
    restoreSearch,
    searchError,
    prepareBands,
    send,
    saveNote,
    cancelSearch: () => {
      searchAbort.current?.abort();
      setBusy(false);
      setNotice('Anulowano wyszukiwanie.');
    },
    cancelJob: async () => {
      if (latest.current.jobId) await api(`/jobs/${latest.current.jobId}/cancel`, {}).catch(report);
    },
    cancelRun: async () => {
      if (runId) await api(`/agent/runs/${runId}/cancel`, {}).catch(report);
    },
  };
}

export type ExplorerController = ReturnType<typeof useExplorer>;
