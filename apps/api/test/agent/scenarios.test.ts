import { RunContext } from '@openai/agents';
import { describe, expect, it, vi } from 'vitest';
import { AgentActions } from '../../src/modules/agent/actions.js';
import { createSkyTools } from '../../src/modules/agent/agent.factory.js';
import type { ToolCall, ViewUpdate } from '../../src/modules/agent/ports.js';
import { FixtureObservations, MemoryWorkspace, demoSearchInput } from '../fixtures/workspace.js';

function setup() {
  const workspace = new MemoryWorkspace();
  const observations = new FixtureObservations();
  const calls: ToolCall[] = [];
  const updates: ViewUpdate[] = [];
  const agent = (revision = 0, sessionId = 'session-a', signal?: AbortSignal) => new AgentActions(workspace, observations, {
    sessionId, runId: 'run-a', expectedRevision: revision, signal,
    onToolCall: (call) => calls.push(call), onViewUpdate: (update) => updates.push(update),
  });
  const actions = agent();
  const search = () => actions.searchObservations({ targetId: 'wise-0855', input: demoSearchInput });
  const prepare = async () => {
    const found = await search();
    return actions.prepareSequence({ searchId: found.id, observationIds: ['demo-epoch-b', 'demo-epoch-a'] });
  };
  return { workspace, observations, calls, updates, agent, actions, search, prepare };
}

describe('scenariusze narzędzi agenta — bez wywołania modelu', () => {
  it('SC01: rozpoznaje obiekt i przekazuje współrzędne do wyszukiwania', async () => {
    const s = setup();
    const target = await s.actions.resolveTarget({ name: 'WISE 0855' });
    const found = await s.actions.searchObservations({ targetId: target.id, input: { ...demoSearchInput, raDeg: target.raDeg, decDeg: target.decDeg } });
    expect(found.dataMode).toBe('demo');
    expect(s.calls.map((call) => call.name)).toEqual(['resolve_target', 'search_observations']);
    expect((await s.workspace.get('session-a')).searchInput?.raDeg).toBe(target.raDeg);
  });
  it('SC02: współrzędne, daty i pole są widoczne w zatwierdzonym stanie kontrolek', async () => {
    const s = setup();
    const input = { ...demoSearchInput, fovDeg: 0.2, fromUtc: '2025-06-01T00:00:00Z', toUtc: '2026-01-01T00:00:00Z' };
    await s.actions.searchObservations({ targetId: null, input });
    expect(s.updates[0]?.state.searchInput).toEqual(input);
    expect(s.updates.at(-1)?.state.searchId).not.toBeNull();
  });
  it('SC03: ustawia checkboxy, porządkuje daty i otwiera przygotowane klatki', async () => {
    const s = setup(); const sequence = await s.prepare();
    const state = await s.actions.getSelection();
    expect(state.selectedObservationIds).toEqual(['demo-epoch-a', 'demo-epoch-b']);
    expect(state.sequenceId).toBe(sequence.id);
    expect(state.frameIds).toEqual(sequence.frameIds);
    expect(state.mode).toBe('blink');
  });
  it('SC04: tryb A/B oraz tempo aktualizują ten sam stan widoku', async () => {
    const s = setup(); const sequence = await s.prepare();
    await s.actions.setView({ sequenceId: sequence.id, frameIds: sequence.frameIds, mode: 'side_by_side' });
    await s.actions.setPlayback({ playing: true, fps: 1 });
    expect(await s.actions.getSelection()).toMatchObject({ mode: 'side_by_side', fps: 1, playing: true, lastChangedBy: 'agent' });
  });
  it('SC05: nowy run uwzględnia ręczną poprawkę bez resetowania pozostałych ustawień', async () => {
    const s = setup(); const sequence = await s.prepare();
    const before = await s.workspace.get('session-a');
    const edited = await s.workspace.patch('session-a', { fps: 1 }, before.viewRevision, 'user');
    const nextAgent = s.agent(edited.viewRevision);
    expect((await nextAgent.getSelection()).fps).toBe(1);
    await nextAgent.setPlayback({ playing: true, fps: 1 });
    expect(await s.workspace.get('session-a')).toMatchObject({ sequenceId: sequence.id, fps: 1, playing: true });
  });
  it('SC06: stary run nie nadpisuje nowszej ręcznej edycji', async () => {
    const s = setup(); await s.prepare();
    const before = await s.workspace.get('session-a');
    await s.workspace.patch('session-a', { fps: 0.5 }, before.viewRevision, 'user');
    await expect(s.actions.setPlayback({ playing: true, fps: 3 })).rejects.toMatchObject({ code: 'VIEW_CONFLICT' });
    expect((await s.workspace.get('session-a')).fps).toBe(0.5);
  });
  it('SC07: pusty wynik nie tworzy fikcyjnej sekwencji', async () => {
    const s = setup(); s.observations.empty = true;
    const found = await s.search();
    expect(found.observations).toEqual([]);
    await expect(s.actions.prepareSequence({ searchId: found.id, observationIds: ['fake-a', 'fake-b'] })).rejects.toMatchObject({ code: 'INVALID_SELECTION' });
    expect(s.observations.sequences.size).toBe(0);
  });
  it('SC08: nieznana nazwa nie dostaje wymyślonych współrzędnych', async () => {
    const s = setup();
    await expect(s.actions.resolveTarget({ name: 'nieznany obiekt' })).rejects.toMatchObject({ code: 'TARGET_UNKNOWN' });
    expect((await s.workspace.get('session-a')).searchInput).toBeNull();
  });
  it('SC09: odrzuca porównanie niezgodnych pasm i zduplikowanych obserwacji', async () => {
    const s = setup(); const found = await s.search();
    await expect(s.actions.prepareSequence({ searchId: found.id, observationIds: ['demo-epoch-a', 'demo-other-band'] })).rejects.toMatchObject({ code: 'NO_COMPARABLE_FRAMES' });
    await expect(s.actions.prepareSequence({ searchId: found.id, observationIds: ['demo-epoch-a', 'demo-epoch-a'] })).rejects.toMatchObject({ code: 'INVALID_SELECTION' });
    expect(s.observations.sequences.size).toBe(0);
  });
  it('SC10: nie odczytuje ani nie otwiera zasobów innej sesji', async () => {
    const s = setup(); const sequence = await s.prepare();
    const other = s.agent(0, 'session-b');
    await expect(other.setView({ sequenceId: sequence.id, frameIds: sequence.frameIds, mode: 'blink' })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    const state = await s.workspace.get('session-a');
    await expect(other.prepareSequence({ searchId: state.searchId!, observationIds: sequence.observationIds })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect((await other.getSelection()).sequenceId).toBeNull();
  });
  it('SC11: notatka wymaga wskazanego punktu; powtórzenie zapisu jest idempotentne', async () => {
    const s = setup(); const sequence = await s.prepare();
    const input = { sequenceId: sequence.id, raDeg: 133.8, decDeg: -7.2, text: 'Kandydat do sprawdzenia' };
    await expect(s.actions.saveAnnotation(input)).rejects.toMatchObject({ code: 'SELECTION_REQUIRED' });
    const before = await s.workspace.get('session-a');
    const selected = await s.workspace.patch('session-a', { selectedPoint: { raDeg: input.raDeg, decDeg: input.decDeg } }, before.viewRevision, 'user');
    const next = s.agent(selected.viewRevision);
    const a = await next.saveAnnotation(input); const b = await next.saveAnnotation(input);
    expect(a.id).toBe(b.id); expect(s.observations.annotations.size).toBe(1);
  });
  it('SC12: anulowanie nie rozpoczyna operacji ani nie zmienia kontrolek', async () => {
    const s = setup(); const controller = new AbortController(); controller.abort();
    await expect(s.agent(0, 'session-a', controller.signal).searchObservations({ targetId: null, input: demoSearchInput })).rejects.toThrow();
    expect(s.observations.searches.size).toBe(0);
    expect((await s.workspace.get('session-a')).viewRevision).toBe(0);
  });
  it('SC13: spóźniony wynik wyszukiwania nie zastępuje nowszej edycji', async () => {
    const s = setup(); const original = s.observations.search.bind(s.observations);
    let finish!: () => void;
    const delayed = new Promise<void>((resolve) => { finish = resolve; });
    vi.spyOn(s.observations, 'search').mockImplementation(async (...args) => { await delayed; return original(...args); });
    const pending = s.search();
    await vi.waitFor(() => expect(s.observations.search).toHaveBeenCalled());
    const before = await s.workspace.get('session-a');
    await s.workspace.patch('session-a', { searchInput: { ...demoSearchInput, fovDeg: 0.3 } }, before.viewRevision, 'user');
    const assertion = expect(pending).rejects.toMatchObject({ code: 'VIEW_CONFLICT' });
    finish(); await assertion;
    expect((await s.workspace.get('session-a')).searchInput?.fovDeg).toBe(0.3);
    expect((await s.workspace.get('session-a')).searchId).toBeNull();
  });
  it('SC14: awaria źródła nie zwraca fikcyjnego sukcesu ani obrazów', async () => {
    const s = setup(); s.observations.unavailable = true;
    await expect(s.search()).rejects.toThrow('Symulowana niedostępność');
    expect((await s.workspace.get('session-a')).sequenceId).toBeNull();
    expect(s.observations.sequences.size).toBe(0);
  });
  it('SC15: rzeczywisty adapter SDK waliduje argumenty przed zmianą stanu', async () => {
    const s = setup();
    const playback = createSkyTools(s.actions).find((item) => item.name === 'set_playback')!;
    await playback.invoke(new RunContext(), JSON.stringify({ playing: false, fps: 100 }));
    expect((await s.workspace.get('session-a')).fps).toBe(2);
    expect(s.calls).toEqual([]);
  });
  it('SC16: narzędzie SDK zwraca kontrolowany błąd domenowy i poprawny stan po sukcesie', async () => {
    const s = setup();
    const tools = createSkyTools(s.actions);
    const resolve = tools.find((item) => item.name === 'resolve_target')!;
    const output = await resolve.invoke(new RunContext(), JSON.stringify({ name: 'unknown' }));
    expect(output).toMatchObject({ ok: false, error: { code: 'TARGET_UNKNOWN' } });
    const playback = tools.find((item) => item.name === 'set_playback')!;
    await playback.invoke(new RunContext(), JSON.stringify({ playing: false, fps: 1 }));
    expect((await s.workspace.get('session-a')).fps).toBe(1);
  });
});
