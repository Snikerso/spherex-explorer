import { createHash, randomUUID } from 'node:crypto';
import { DomainError, type SearchInput, type ViewPatch, type ViewState } from '@spherex/contracts';
import type { AnnotationInput, ObservationPort, ToolCall, ViewUpdate, WorkspacePort } from './ports.js';

export interface ActionContext {
  sessionId: string;
  runId: string;
  expectedRevision: number;
  signal?: AbortSignal;
  onToolCall?: (call: ToolCall) => void;
  onViewUpdate?: (update: ViewUpdate) => void;
}

// To jest wspólna logika narzędzi, nie parser poleceń języka naturalnego.
// Adapter IRSA i asynchroniczny pipeline będą implementować ObservationPort.
export class AgentActions {
  constructor(private readonly workspace: WorkspacePort, private readonly observations: ObservationPort, private readonly context: ActionContext) {}

  private record(name: string, args: unknown) {
    this.context.signal?.throwIfAborted();
    this.context.onToolCall?.({ name, arguments: args });
  }
  private async commit(patch: ViewPatch) {
    this.context.signal?.throwIfAborted();
    const state = await this.workspace.patch(this.context.sessionId, patch, this.context.expectedRevision, 'agent');
    this.context.expectedRevision = state.viewRevision;
    this.context.onViewUpdate?.({ state, changedFields: Object.keys(patch) });
    return state;
  }
  async resolveTarget(args: { name: string }) {
    this.record('resolve_target', args);
    const target = await this.observations.resolveTarget(args.name, this.context.signal);
    if (!target) throw new DomainError('TARGET_UNKNOWN', 'Brak nazwy w katalogu przykładów. Podaj współrzędne RA/Dec.');
    return target;
  }
  async searchObservations(args: { targetId: string | null; input: SearchInput }) {
    this.record('search_observations', args);
    await this.commit({ targetId: args.targetId, searchInput: args.input, searchId: null, searchRequestId: randomUUID(), selectedObservationIds: [], jobId: null, playing: false });
    const result = await this.observations.search(this.context.sessionId, args.input, this.context.signal);
    if (result.sessionId !== this.context.sessionId) throw new DomainError('RESOURCE_NOT_FOUND', 'Wynik niedostępny.');
    await this.commit({ searchId: result.id });
    return result;
  }
  async prepareSequence(args: { searchId: string; observationIds: string[] }) {
    this.record('prepare_sequence', args);
    const search = await this.observations.getSearch(this.context.sessionId, args.searchId);
    if (!search || search.sessionId !== this.context.sessionId) throw new DomainError('RESOURCE_NOT_FOUND', 'Wyszukiwanie niedostępne.');
    const view = await this.workspace.get(this.context.sessionId);
    if (view.searchId !== search.id) throw new DomainError('VIEW_CONFLICT', 'Wybrano już inne wyszukiwanie.');
    const ids = new Set(args.observationIds);
    const selected = search.observations.filter((observation) => ids.has(observation.id));
    if (ids.size !== args.observationIds.length || ids.size < 2 || ids.size > 24 || selected.length !== ids.size) {
      throw new DomainError('INVALID_SELECTION', 'Wybierz od 2 do 24 różnych obserwacji z bieżącego wyszukiwania.');
    }
    if (new Set(selected.map((observation) => observation.comparisonGroup)).size !== 1 || new Set(selected.map((observation) => observation.observedAtUtc)).size < 2) {
      throw new DomainError('NO_COMPARABLE_FRAMES', 'Wybrane klatki nie tworzą porównywalnej sekwencji z różnych dat.');
    }
    const orderedIds = selected.sort((a, b) => Date.parse(a.observedAtUtc) - Date.parse(b.observedAtUtc)).map((observation) => observation.id);
    await this.commit({ selectedObservationIds: orderedIds, playing: false });
    const sequence = await this.observations.prepare(this.context.sessionId, orderedIds, this.context.signal);
    if (sequence.sessionId !== this.context.sessionId) throw new DomainError('RESOURCE_NOT_FOUND', 'Sekwencja niedostępna.');
    await this.commit({
      jobId: sequence.jobId,
      ...(sequence.status === 'ready' ? { sequenceId: sequence.id, frameIds: sequence.frameIds, mode: 'blink' } : {}),
    });
    return sequence;
  }
  async setView(args: { sequenceId: string; mode: ViewState['mode']; frameIds: string[] }) {
    this.record('set_view', args);
    const sequence = await this.observations.getSequence(this.context.sessionId, args.sequenceId);
    if (!sequence || sequence.sessionId !== this.context.sessionId) throw new DomainError('RESOURCE_NOT_FOUND', 'Sekwencja niedostępna.');
    if (sequence.status !== 'ready' || args.frameIds.length === 0 || new Set(args.frameIds).size !== args.frameIds.length || args.frameIds.some((id) => !sequence.frameIds.includes(id))) {
      throw new DomainError('INVALID_SELECTION', 'Wybierz przygotowane klatki z tej sekwencji.');
    }
    if (args.mode !== 'single' && args.frameIds.length < 2) throw new DomainError('NO_COMPARABLE_FRAMES', 'Porównanie wymaga przynajmniej dwóch klatek.');
    return this.commit({ sequenceId: sequence.id, frameIds: args.frameIds, mode: args.mode, playing: false });
  }
  async setPlayback(args: { playing: boolean; fps: number }) {
    this.record('set_playback', args);
    return this.commit(args);
  }
  async getSelection() {
    this.record('get_selection', {});
    return this.workspace.get(this.context.sessionId);
  }
  async saveAnnotation(args: AnnotationInput) {
    this.record('save_annotation', args);
    const sequence = await this.observations.getSequence(this.context.sessionId, args.sequenceId);
    if (!sequence || sequence.sessionId !== this.context.sessionId) throw new DomainError('RESOURCE_NOT_FOUND', 'Sekwencja niedostępna.');
    const view = await this.workspace.get(this.context.sessionId);
    if (view.viewRevision !== this.context.expectedRevision) throw new DomainError('VIEW_CONFLICT', 'Zaznaczenie zmieniło się podczas działania agenta.');
    if (view.sequenceId !== args.sequenceId || !view.selectedPoint || view.selectedPoint.raDeg !== args.raDeg || view.selectedPoint.decDeg !== args.decDeg) {
      throw new DomainError('SELECTION_REQUIRED', 'Najpierw zaznacz ten punkt na obrazie.');
    }
    this.context.signal?.throwIfAborted();
    const key = createHash('sha256').update(JSON.stringify([this.context.runId, args])).digest('hex');
    return this.observations.saveAnnotation(this.context.sessionId, args, key);
  }
}
